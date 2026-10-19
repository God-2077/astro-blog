/**
 * Generate the unified image manifest: LQIP gradients + intrinsic dimensions.
 *
 * Replaces the former generateLqips.ts. Sources scanned:
 *
 *   1. local  — `public/**\/*.{webp,jpg,jpeg,png}` (keys are site-absolute paths)
 *   2. remote — `cover` frontmatter + `![alt](src)` markdown images in the
 *               directories configured by `imageManifest.contentDirs`
 *               (default `src/content/blog`; HTTP(S) only, opt-in)
 *
 * Output: src/assets/image-manifest.json
 *
 * Incremental by default (requirement: only add/delete, leave existing entries
 * alone): local files are compared by sha256, remote images revalidate with
 * `If-None-Match` / `If-Modified-Since`. Use `--force` for a full recompute.
 *
 * Existing entries are reused as long as their source is still inside the scan
 * scope. References that disappear from the scanned content are pruned, so a
 * misconfigured content dir used to wipe every remote entry; the generator now
 * guards against that (missing dirs / zero references preserve the manifest).
 *
 * Usage:
 *   pnpm generate:images                  # incremental
 *   pnpm generate:images --force          # recompute everything
 *   pnpm generate:images --remote         # override config, fetch external info
 *   pnpm generate:images --strict         # exit non-zero if any image fails
 *   pnpm generate:images --content-dirs ../astro-blog-content/src/content/blog
 *   pnpm generate:images --allowed-domains ik.imagekit.io,'*.example.com'
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { glob } from 'glob';
import { imageSize } from 'image-size';
import sharp from 'sharp';
import YAML from 'yaml';
import {
  createLocalEntry,
  createRemoteEntry,
  createScanStats,
  DEFAULT_LOCAL_GLOB,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_PUBLIC_DIR,
  detectKeyCollisions,
  extractPostImageRefs,
  getUrlPathname,
  type ImageDimensions,
  type ImageManifest,
  type ImageManifestEntry,
  isSkippedKey,
  isSupportedImage,
  mergeImages,
  normalizeSkipPatterns,
  readManifest,
  type ScanStats,
  SUPPORTED_CONTENT_TYPES,
  sha256Buffer,
  toSitePath,
  writeManifest,
} from './lib/image-manifest';
import type { RgbColor } from './lib/lqip-color';
import {
  buildContentGlob,
  type ContentDir,
  type DomainAllowlist,
  isSkippedContentFile,
  isUrlAllowed,
  resolveAllowedDomains,
  resolveContentDirs,
} from './lib/scan-scope';

// --------- Configuration ---------
const SITE_CONFIG_PATH = 'config/site.yaml';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const NETWORK_DEFAULTS = {
  concurrency: 6,
  timeoutMs: 15_000,
  retries: 2,
  maxBytes: 10 * 1024 * 1024,
  rangeBytes: 65_535,
};

interface NetworkConfig {
  concurrency: number;
  timeoutMs: number;
  retries: number;
  maxBytes: number;
}

interface SiteYamlShape {
  site?: { url?: string };
  imageManifest?: {
    generateExternal?: boolean;
    concurrency?: number;
    timeoutMs?: number;
    retries?: number;
    maxBytes?: number;
    /** Post directories to scan; string or string[], validated at load time. */
    contentDirs?: unknown;
    /** External image host allowlist; string or string[], validated at load time. */
    allowedDomains?: unknown;
    scan?: { skip?: unknown };
  };
}

interface CliOptions {
  force: boolean;
  strict: boolean;
  remoteOverride?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  maxBytes?: number;
  /** CLI override for imageManifest.contentDirs (already split into entries). */
  contentDirs?: string[];
  /** CLI override for imageManifest.allowedDomains (already split into entries). */
  allowedDomains?: string[];
}

// --------- CLI ---------
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { force: false, strict: false };

  const readNumber = (raw: string | undefined, flag: string): number => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (value === 0 && flag !== '--retries')) {
      throw new Error(`Invalid value for ${flag}: ${String(raw)}`);
    }
    return value;
  };

  const readList = (raw: string | undefined, flag: string): string[] => {
    const values = (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!values.length) throw new Error(`Invalid value for ${flag}: expected a comma-separated list`);
    return values;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1);
    const takeValue = (): string | undefined => (inlineValue !== undefined ? inlineValue : argv[++i]);

    switch (flag) {
      case '--force':
      case '-force':
        options.force = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--remote':
        options.remoteOverride = true;
        break;
      case '--no-remote':
        options.remoteOverride = false;
        break;
      case '--concurrency':
        options.concurrency = readNumber(takeValue(), flag);
        break;
      case '--timeout':
        options.timeoutMs = readNumber(takeValue(), flag);
        break;
      case '--retries':
        options.retries = readNumber(takeValue(), flag);
        break;
      case '--max-bytes':
        options.maxBytes = readNumber(takeValue(), flag);
        break;
      case '--content-dirs':
        options.contentDirs = readList(takeValue(), flag);
        break;
      case '--allowed-domains':
        options.allowedDomains = readList(takeValue(), flag);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

// --------- Site config ---------

interface LoadedSiteConfig {
  config: SiteYamlShape;
  skipPatterns: string[];
  contentDirs: ContentDir[];
  allowlist: DomainAllowlist;
  fatal?: string;
}

async function loadSiteConfig(): Promise<LoadedSiteConfig> {
  const defaults = (): Omit<LoadedSiteConfig, 'config'> => ({
    skipPatterns: [],
    contentDirs: resolveContentDirs(undefined),
    allowlist: resolveAllowedDomains(undefined),
  });
  const fail = (fatal: string, config: SiteYamlShape = {}): LoadedSiteConfig => ({ config, ...defaults(), fatal });

  let raw: string;
  try {
    raw = await fs.readFile(SITE_CONFIG_PATH, 'utf-8');
  } catch {
    return { config: {}, ...defaults() };
  }

  let config: SiteYamlShape;
  try {
    config = (YAML.parse(raw) ?? {}) as SiteYamlShape;
  } catch (error) {
    return fail(`Failed to parse ${SITE_CONFIG_PATH}: ${(error as Error).message}`);
  }

  const rawSkip = config.imageManifest?.scan?.skip;
  if (rawSkip !== undefined && !Array.isArray(rawSkip)) {
    return fail('imageManifest.scan.skip must be a list of strings', config);
  }

  let skipPatterns: string[];
  try {
    skipPatterns = normalizeSkipPatterns(rawSkip as string[] | undefined);
  } catch (error) {
    return fail(`Invalid imageManifest.scan.skip: ${(error as Error).message}`, config);
  }

  let contentDirs: ContentDir[];
  try {
    contentDirs = resolveContentDirs(config.imageManifest?.contentDirs);
  } catch (error) {
    return fail(`Invalid imageManifest.contentDirs: ${(error as Error).message}`, config);
  }

  let allowlist: DomainAllowlist;
  try {
    allowlist = resolveAllowedDomains(config.imageManifest?.allowedDomains);
  } catch (error) {
    return fail(`Invalid imageManifest.allowedDomains: ${(error as Error).message}`, config);
  }

  return { config, skipPatterns, contentDirs, allowlist };
}

// --------- Image processing ---------

/** Read dimensions from raw bytes (works on a truncated HTTP range response). */
function readDimensions(buffer: Buffer): ImageDimensions | null {
  try {
    const result = imageSize(buffer);
    if (result.width && result.height) return { width: result.width, height: result.height };
  } catch {
    // fall through
  }
  return null;
}

/** Extract the 4 quadrant colors from raw bytes and compress to 3 gradients stops. */
async function extractLqipColors(buffer: Buffer): Promise<[RgbColor, RgbColor, RgbColor]> {
  const { data, info } = await sharp(buffer).resize(2, 2, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  const colorAt = (index: number): RgbColor => {
    const offset = index * channels;
    return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
  };

  // top-left, top-right, bottom-right are used for 0% / 50% / 100%
  return [colorAt(0), colorAt(1), colorAt(3)];
}

interface ProcessedImage {
  dimensions: ImageDimensions;
  colors: [RgbColor, RgbColor, RgbColor];
}

/**
 * Measure dimensions (from `head`) and colors (from `body`) of an image.
 *
 * `head` may be a truncated HTTP range response; `body` must be complete enough
 * for libvips to decode, so callers pass the full buffer.
 */
async function processImageBytes(head: Buffer, body: Buffer): Promise<ProcessedImage> {
  const dimensions = readDimensions(head);
  if (!dimensions) throw new Error('unable to read image dimensions (corrupt or unsupported image data)');

  const colors = await extractLqipColors(body);
  return { dimensions, colors };
}

// --------- Fetch with timeout / retry ---------

class FetchError extends Error {
  readonly transient: boolean;

  constructor(message: string, transient: boolean) {
    super(message);
    this.name = 'FetchError';
    this.transient = transient;
  }
}

interface FetchedImage {
  /** Null marks a `304 Not Modified` response: keep the stored entry as is. */
  dimensions: ImageDimensions | null;
  colors?: [RgbColor, RgbColor, RgbColor];
  etag?: string;
  lastModified?: string;
}

interface FetchImageOptions {
  timeoutMs: number;
  referer?: string;
  etag?: string;
  lastModified?: string;
  maxBytes: number;
  rangeBytes: number;
  conditional: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Validate response metadata before reading the body. */
function assertAcceptable(url: string, response: Response): string | null {
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (contentType && !(SUPPORTED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return `unsupported content-type: ${contentType}`;
  }
  if (!contentType && !isSupportedImage(url)) {
    return `unsupported image format for ${url}`;
  }
  return null;
}

/** Perform one fetch, translating transport failures into typed errors. */
async function request(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  } catch (error) {
    throw new FetchError(`network error: ${(error as Error).message}`, true);
  }
}

/** Read a response body, honouring the per-image size cap. */
async function readBody(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > maxBytes) {
    throw new FetchError(`image exceeds maxBytes (${contentLength} > ${maxBytes})`, false);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new FetchError(`failed reading response body: ${(error as Error).message}`, true);
  }

  if (!buffer.length) throw new FetchError('empty response body', false);
  if (buffer.length > maxBytes) {
    throw new FetchError(`image exceeds maxBytes (${buffer.length} > ${maxBytes})`, false);
  }
  return buffer;
}

/**
 * Download an image, preferring a ranged request so only the image header is
 * transferred for measurement.
 *
 * `image-size` reads dimensions from the leading bytes, but libvips (sharp)
 * needs the complete file to decode colors, so a partial response is followed by
 * a second, un-ranged request for the body.
 *
 * Returns null when the resource is valid but unsupported (counted as skipped);
 * a 304 yields `dimensions: null` so the caller keeps the stored entry.
 */
async function fetchImage(url: string, options: FetchImageOptions): Promise<FetchedImage | null> {
  const baseHeaders: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
  };
  if (options.referer) baseHeaders.Referer = options.referer;
  if (options.conditional) {
    if (options.etag) baseHeaders['If-None-Match'] = options.etag;
    if (options.lastModified) baseHeaders['If-Modified-Since'] = options.lastModified;
  }

  let response = await request(url, { ...baseHeaders, Range: `bytes=0-${options.rangeBytes - 1}` }, options.timeoutMs);

  // A server that ignores Range returns 200 (full body) or 416; both are fine,
  // but ask again without the header to get a predictable full response.
  if (response.status === 416) {
    response = await request(url, baseHeaders, options.timeoutMs);
  }

  if (response.status === 304) {
    return { dimensions: null, etag: options.etag, lastModified: options.lastModified };
  }
  if (response.status === 429 || response.status >= 500) {
    throw new FetchError(`HTTP ${response.status}`, true);
  }
  if (response.status >= 400) {
    throw new FetchError(`HTTP ${response.status}`, false);
  }

  const unsupported = assertAcceptable(url, response);
  if (unsupported) return null;

  const etag = response.headers.get('etag') ?? undefined;
  const lastModified = response.headers.get('last-modified') ?? undefined;
  const buffer = await readBody(response, options.maxBytes);

  // 206 or a Content-Range spanning less than the whole resource ⇒ partial body.
  const contentRange = response.headers.get('content-range');
  const partial = response.status === 206 || /^bytes \d+-\d+\/(\d+)$/.test(contentRange ?? '');

  const dimensions = readDimensions(buffer);
  if (!dimensions) throw new FetchError('unable to read image dimensions (corrupt or unsupported data)', false);

  let full = buffer;
  if (partial) {
    const fullResponse = await request(url, baseHeaders, options.timeoutMs);
    if (fullResponse.status === 429 || fullResponse.status >= 500) {
      throw new FetchError(`HTTP ${fullResponse.status}`, true);
    }
    if (fullResponse.status >= 400) {
      throw new FetchError(`HTTP ${fullResponse.status} while fetching full body`, false);
    }
    full = await readBody(fullResponse, options.maxBytes);
  }

  const colors = await extractLqipColors(full);
  return { dimensions, colors, etag, lastModified };
}

async function fetchImageWithRetry(url: string, options: FetchImageOptions, retries: number): Promise<FetchedImage | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(500 * 2 ** (attempt - 1) + Math.random() * 200);
    }
    try {
      return await fetchImage(url, options);
    } catch (error) {
      lastError = error as Error;
      if (!(error instanceof FetchError) || !error.transient) break;
    }
  }

  throw lastError ?? new Error('unknown fetch failure');
}

// --------- Concurrency ---------

/** Run `worker` over `items` with a bounded number of in-flight tasks. */
async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  const runners = Array.from({ length: limit }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });

  await Promise.all(runners);
}

// --------- Phases ---------

interface LocalPhaseResult {
  entries: Record<string, ImageManifestEntry>;
  reusedKeys: Set<string>;
  collisions: { key: string; kept: string; dropped: string }[];
}

async function scanLocalImages(
  prev: ImageManifest | null,
  skipPatterns: readonly string[],
  force: boolean,
  stats: ScanStats,
  publicDir: string,
): Promise<LocalPhaseResult> {
  const entries: Record<string, ImageManifestEntry> = {};
  const reusedKeys = new Set<string>();
  const collisionPairs: { key: string; sourcePath: string }[] = [];

  const files = await glob(DEFAULT_LOCAL_GLOB, { nodir: true });
  stats.scannedFiles += files.length;

  let skippedFiles = 0;

  for (const rawFile of files) {
    const file = rawFile.replace(/\\/g, '/');
    const sitePath = toSitePath(file, publicDir);

    if (isSkippedKey(sitePath, skipPatterns)) {
      skippedFiles++;
      continue;
    }
    if (!isSupportedImage(file)) {
      stats.skippedFormat++;
      continue;
    }

    collisionPairs.push({ key: sitePath, sourcePath: file });

    const previous = prev?.images[sitePath];
    try {
      // Read once: the same bytes provide both the change detector and the image data.
      const buffer = await fs.readFile(file);
      const hash = sha256Buffer(buffer);

      if (!force && previous?.source === 'local' && previous.hash === hash) {
        entries[sitePath] = previous;
        reusedKeys.add(sitePath);
        stats.reused++;
        continue;
      }

      const { dimensions, colors } = await processImageBytes(buffer, buffer);
      entries[sitePath] = createLocalEntry({ src: sitePath, dimensions, colors, hash });
      if (previous) stats.updated++;
      else stats.added++;
    } catch (error) {
      stats.failed++;
      console.log(chalk.red(`  Error processing ${file}: ${(error as Error).message}`));
      if (previous) entries[sitePath] = previous;
    }
  }

  if (skippedFiles > 0) {
    console.log(chalk.gray(`  (skipped ${skippedFiles} local files via imageManifest.scan.skip)`));
  }

  return { entries, reusedKeys, collisions: detectKeyCollisions(collisionPairs) };
}

interface RemotePhaseResult {
  entries: Record<string, ImageManifestEntry>;
  preservedKeys: Set<string>;
  updatedKeys: Set<string>;
  skippedUrls: string[];
  /** URLs referenced by posts but rejected by `imageManifest.allowedDomains`. */
  blockedUrls: string[];
  failures: { key: string; reason: string }[];
  /** Number of md/mdx files found across every configured content directory. */
  contentFiles: number;
  /** True when nothing was fetchable and existing remote entries must survive. */
  preserveAll: boolean;
}

async function scanRemoteImages(
  prev: ImageManifest | null,
  skipPatterns: readonly string[],
  options: CliOptions,
  network: NetworkConfig,
  siteUrl: string | undefined,
  stats: ScanStats,
  contentDirs: readonly ContentDir[],
  allowlist: DomainAllowlist,
): Promise<RemotePhaseResult> {
  const entries: Record<string, ImageManifestEntry> = {};
  const preservedKeys = new Set<string>();
  const updatedKeys = new Set<string>();
  const skippedUrls: string[] = [];
  const blockedUrls = new Set<string>();
  const failures: { key: string; reason: string }[] = [];

  const previousRemoteKeys = Object.entries(prev?.images ?? {})
    .filter(([, entry]) => entry.source === 'remote')
    .map(([key]) => key);

  // Glob every configured directory first, de-duplicating overlapping roots and
  // symlink/junction aliases (via realpath) so each file is read exactly once.
  const contentFiles: { file: string; dir: ContentDir }[] = [];
  const seenFiles = new Set<string>();
  for (const dir of contentDirs) {
    const matched = await glob(buildContentGlob(dir.path), { nodir: true, follow: true });
    for (const rawFile of matched) {
      const file = path.resolve(rawFile);
      // Keep the configured spelling for skip matching, but dedupe on the real path.
      const real = await fs.realpath(file).catch(() => file);
      if (seenFiles.has(real)) continue;
      seenFiles.add(real);
      contentFiles.push({ file, dir });
    }
  }

  console.log(chalk.gray(`  ${contentFiles.length} content file(s) in ${contentDirs.length} directory(ies)`));

  const refs = new Set<string>();
  const unsupportedRefs = new Set<string>();
  let scannedFiles = 0;

  for (const { file, dir } of contentFiles) {
    if (isSkippedContentFile(file, dir.path, skipPatterns)) continue;

    scannedFiles++;
    let source: string;
    try {
      source = await fs.readFile(file, 'utf-8');
    } catch (error) {
      stats.failed++;
      console.log(chalk.red(`  Error reading ${file}: ${(error as Error).message}`));
      continue;
    }

    const { covers, bodyImages } = extractPostImageRefs(source);
    for (const ref of [...covers, ...bodyImages]) {
      if (isSkippedKey(getUrlPathname(ref), skipPatterns)) continue;
      if (!isSupportedImage(ref)) {
        unsupportedRefs.add(ref);
        continue;
      }
      if (!isUrlAllowed(ref, allowlist)) {
        // Never fetched. Keep a stored entry unless --force asks for a clean recompute.
        blockedUrls.add(ref);
        if (!options.force && prev?.images[ref]) preservedKeys.add(ref);
        continue;
      }
      refs.add(ref);
    }
  }

  stats.scannedFiles += scannedFiles;

  if (unsupportedRefs.size) {
    console.log(chalk.gray(`  (skipped ${unsupportedRefs.size} references with unsupported extension)`));
  }
  if (blockedUrls.size) {
    console.log(chalk.gray(`  (blocked ${blockedUrls.size} references by imageManifest.allowedDomains)`));
  }

  // Safety valve: a misconfigured content path (or an empty content tree) yields
  // no references at all. Pruning would then wipe a valid manifest, so keep the
  // stored remote entries unless the user explicitly forces a recompute.
  if (!refs.size) {
    const preserveAll = !options.force && previousRemoteKeys.length > 0;
    if (preserveAll) {
      console.log(
        chalk.yellow(
          `  No external images to fetch; keeping ${previousRemoteKeys.length} remote entries (use --force to prune).`,
        ),
      );
    } else {
      console.log(chalk.gray(`  No external images referenced by content.`));
    }
    return {
      entries,
      preservedKeys,
      updatedKeys,
      skippedUrls,
      blockedUrls: [...blockedUrls],
      failures,
      contentFiles: contentFiles.length,
      preserveAll,
    };
  }

  const targets = [...refs];
  console.log(chalk.blue(`  Fetching ${targets.length} external images (concurrency ${network.concurrency})...`));

  let done = 0;
  await runPool(targets, network.concurrency, async (url) => {
    const previous = prev?.images[url];
    const conditional = !options.force && previous?.source === 'remote';

    try {
      const fetched = await fetchImageWithRetry(
        url,
        {
          timeoutMs: network.timeoutMs,
          referer: siteUrl,
          etag: conditional ? previous.etag : undefined,
          lastModified: conditional ? previous.lastModified : undefined,
          maxBytes: network.maxBytes,
          rangeBytes: NETWORK_DEFAULTS.rangeBytes,
          conditional,
        },
        network.retries,
      );

      if (fetched === null) {
        skippedUrls.push(url);
        if (previous) preservedKeys.add(url);
      } else if (fetched.dimensions === null || !fetched.colors) {
        // 304 Not Modified: nothing changed, keep the stored entry untouched.
        if (previous) {
          entries[url] = previous;
          preservedKeys.add(url);
          stats.reused++;
        }
      } else {
        entries[url] = createRemoteEntry({
          src: url,
          dimensions: fetched.dimensions,
          colors: fetched.colors,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
        });
        updatedKeys.add(url);
        if (previous) stats.updated++;
        else stats.added++;
      }
    } catch (error) {
      stats.failed++;
      failures.push({ key: url, reason: (error as Error).message });
      if (previous) entries[url] = previous;
    }

    done++;
    process.stdout.write(`\r  Progress ${done}/${targets.length} `);
  });

  process.stdout.write('\n');
  return {
    entries,
    preservedKeys,
    updatedKeys,
    skippedUrls,
    blockedUrls: [...blockedUrls],
    failures,
    contentFiles: contentFiles.length,
    preserveAll: false,
  };
}

// --------- Main ---------

async function main(): Promise<number> {
  const startTime = Date.now();
  const options = parseArgs(process.argv.slice(2));

  console.log(chalk.cyan('=== Image Manifest Generator ===\n'));

  const loaded = await loadSiteConfig();
  const { config, skipPatterns, fatal } = loaded;
  if (fatal) {
    console.error(chalk.red(`Error: ${fatal}`));
    return 1;
  }

  const manifestConfig = config.imageManifest ?? {};
  const generateExternal = options.remoteOverride ?? manifestConfig.generateExternal ?? false;
  const network: NetworkConfig = {
    concurrency: options.concurrency ?? manifestConfig.concurrency ?? NETWORK_DEFAULTS.concurrency,
    timeoutMs: options.timeoutMs ?? manifestConfig.timeoutMs ?? NETWORK_DEFAULTS.timeoutMs,
    retries: options.retries ?? manifestConfig.retries ?? NETWORK_DEFAULTS.retries,
    maxBytes: options.maxBytes ?? manifestConfig.maxBytes ?? NETWORK_DEFAULTS.maxBytes,
  };

  // CLI flags win over site.yaml; both default to the built-in values.
  const contentDirs = options.contentDirs ? resolveContentDirs(options.contentDirs) : loaded.contentDirs;
  const allowlist = options.allowedDomains ? resolveAllowedDomains(options.allowedDomains) : loaded.allowlist;

  console.log(chalk.gray(`Incremental: ${options.force ? 'no (--force, recomputing all)' : 'yes'}`));
  console.log(
    chalk.gray(`External images: ${generateExternal ? 'enabled' : 'disabled (config imageManifest.generateExternal)'}`),
  );
  if (generateExternal) {
    console.log(chalk.gray(`Content dirs: ${contentDirs.map((dir) => dir.label).join(', ')}`));
    console.log(chalk.gray(`Allowed domains: ${allowlist.restricted ? allowlist.patterns.join(', ') : 'unrestricted'}`));
  }
  if (skipPatterns.length) {
    console.log(chalk.gray(`Skipping directories: ${skipPatterns.join(', ')}`));
  }
  console.log('');

  // ---- Content dir preflight ----
  // A typo in contentDirs must never prune a valid manifest: verify the dirs
  // before scanning and leave everything untouched when none of them exist.
  const activeContentDirs: ContentDir[] = [];
  if (generateExternal) {
    for (const dir of contentDirs) {
      const isDirectory = await fs
        .stat(dir.path)
        .then((stat) => stat.isDirectory())
        .catch(() => false);
      if (isDirectory) activeContentDirs.push(dir);
      else console.log(chalk.yellow(`  content dir not found: ${dir.label}`));
    }
    if (!activeContentDirs.length) {
      console.error(chalk.red('Error: none of the configured content dirs exist (imageManifest.contentDirs).'));
      console.error(chalk.gray('  Existing manifest entries were left untouched.'));
      return 1;
    }
  }

  const { manifest: prev, reason } = await readManifest(DEFAULT_MANIFEST_PATH);
  if (reason && reason !== 'not-found') {
    console.log(chalk.yellow(`Existing manifest ignored (${reason}), regenerating from scratch.`));
  }

  const stats = createScanStats();

  // ---- Local images ----
  console.log(chalk.blue('Scanning local images (public/)...'));
  const publicExists = await fs
    .stat(DEFAULT_PUBLIC_DIR)
    .then((s) => s.isDirectory())
    .catch(() => false);

  let local: LocalPhaseResult = { entries: {}, reusedKeys: new Set(), collisions: [] };
  if (publicExists) {
    local = await scanLocalImages(prev, skipPatterns, options.force, stats, DEFAULT_PUBLIC_DIR);
  } else {
    console.log(chalk.yellow(`  ${DEFAULT_PUBLIC_DIR}/ not found, skipping local scan.`));
  }

  // ---- Remote images ----
  const remote: RemotePhaseResult = {
    entries: {},
    preservedKeys: new Set(),
    updatedKeys: new Set(),
    skippedUrls: [],
    blockedUrls: [],
    failures: [],
    contentFiles: 0,
    preserveAll: false,
  };
  let remoteResult = remote;

  if (generateExternal) {
    console.log(chalk.blue('Scanning external images (content)...'));
    remoteResult = await scanRemoteImages(
      prev,
      skipPatterns,
      options,
      network,
      config.site?.url,
      stats,
      activeContentDirs,
      allowlist,
    );
  }

  const nextImages: Record<string, ImageManifestEntry> = { ...local.entries, ...remoteResult.entries };
  const preservedKeys = new Set<string>([...local.reusedKeys, ...remoteResult.preservedKeys]);

  // Never touch existing remote entries when external generation is off, or
  // when the scan found no fetchable references (misconfigured content path):
  // they must survive until the user explicitly asks for a full recompute.
  if (!generateExternal || remoteResult.preserveAll) {
    for (const [key, entry] of Object.entries(prev?.images ?? {})) {
      if (entry.source === 'remote' && !nextImages[key]) preservedKeys.add(key);
    }
  }

  const merged = mergeImages({ nextImages, preservedKeys, skipPatterns, prev });
  stats.deleted = merged.deletedKeys.length;
  stats.keptSkipped = merged.keptSkippedKeys.length;

  await writeManifest(DEFAULT_MANIFEST_PATH, {
    version: prev?.version ?? 1,
    generatorVersion: prev?.generatorVersion ?? 1,
    updatedAt: new Date().toISOString(),
    images: merged.images,
  });

  // ---- Report ----
  const total = Object.keys(merged.images).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log(chalk.cyan('--- Summary ---'));
  console.log(`  Scanned files : ${stats.scannedFiles}`);
  if (generateExternal) {
    console.log(`  Content files : ${remoteResult.contentFiles}`);
  }
  console.log(`  Manifest total: ${total}`);
  console.log(`  Added         : ${stats.added}`);
  console.log(`  Updated       : ${stats.updated}`);
  console.log(`  Reused        : ${stats.reused}`);
  console.log(
    `  Deleted       : ${stats.deleted}${merged.deletedKeys.length ? chalk.gray(` (${merged.deletedKeys.slice(0, 5).join(', ')}${merged.deletedKeys.length > 5 ? ', …' : ''})`) : ''}`,
  );
  if (local.collisions.length) {
    console.log(chalk.red(`  Key collisions: ${local.collisions.length}`));
    for (const collision of local.collisions) {
      console.log(chalk.red(`    ${collision.key}: kept ${collision.kept}, dropped ${collision.dropped}`));
    }
  }
  if (stats.keptSkipped) {
    console.log(chalk.gray(`  Kept (skipped dirs): ${stats.keptSkipped}`));
  }
  if (stats.skippedFormat) {
    console.log(chalk.gray(`  Skipped (format)   : ${stats.skippedFormat}`));
  }
  if (generateExternal) {
    console.log(chalk.gray(`  Blocked (domain)   : ${remoteResult.blockedUrls.length}`));
    console.log(chalk.gray(`  Unsupported remote : ${remoteResult.skippedUrls.length}`));
  }
  if (stats.failed) {
    console.log(chalk.red(`  Failed            : ${stats.failed}`));
    for (const failure of remoteResult.failures.slice(0, 10)) {
      console.log(chalk.red(`    ${failure.key} — ${failure.reason}`));
    }
    if (remoteResult.failures.length > 10) {
      console.log(chalk.red(`    …and ${remoteResult.failures.length - 10} more`));
    }
  }

  console.log(chalk.green(`\nDone in ${elapsed}s → ${DEFAULT_MANIFEST_PATH}`));

  if (generateExternal) {
    console.log(chalk.gray('Note: the manifest is read at build time — restart the dev server or rebuild to see changes.'));
  }
  if (generateExternal && remoteResult.skippedUrls.length) {
    console.log(
      chalk.gray(`      ${remoteResult.skippedUrls.length} references use an unsupported format and were not stored.`),
    );
  }

  const fatalFailures = stats.failed + local.collisions.length;
  if (options.strict && fatalFailures > 0) {
    console.log(chalk.red(`\n--strict: ${fatalFailures} failure(s), exiting with code 1.`));
    return 1;
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(chalk.red('\nError:'), error);
    process.exitCode = 1;
  });
