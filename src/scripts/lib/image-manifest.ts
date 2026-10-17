/**
 * Image manifest core logic (pure, no CLI concerns)
 *
 * The manifest is the single source of truth for per-image metadata used at build
 * time: LQIP gradient colors, intrinsic dimensions, and the data needed for
 * incremental regeneration (content hash for local files, validators for remote).
 *
 * Data shape (src/assets/image-manifest.json):
 *
 *   {
 *     "version": 1,
 *     "generatorVersion": 1,
 *     "updatedAt": "2026-10-13T00:00:00.000Z",
 *     "images": {
 *       "/img/cover.webp": { src, source: "local", width, height, lqip, hash, updatedAt },
 *       "https://a/b.jpg": { src, source: "remote", width, height, lqip, etag, lastModified, updatedAt }
 *     }
 *   }
 *
 * Keys are the lookup label for the image: a site-absolute path for local files
 * (e.g. "/img/cover.webp") or the full URL for remote ones.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { RgbColor } from './lqip-color';
import { formatLqip } from './lqip-color';

// --------- Constants ---------
const MANIFEST_VERSION = 1;
const GENERATOR_VERSION = 1;
export const DEFAULT_MANIFEST_PATH = 'src/assets/image-manifest.json';
export const DEFAULT_PUBLIC_DIR = 'public';
export const DEFAULT_LOCAL_GLOB = 'public/**/*.{webp,jpg,jpeg,png}';
export const DEFAULT_CONTENT_GLOB = 'src/content/blog/**/*.{md,mdx}';

/** Image formats this generator supports (both locally and remotely). */
const SUPPORTED_IMAGE_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'] as const;

/** Response Content-Type values considered valid for remote images. */
export const SUPPORTED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;

// --------- Types ---------
export type ManifestImageSource = 'local' | 'remote';

export interface ImageDimensions {
  width: number;
  height: number;
}

interface ImageEntryBase extends ImageDimensions {
  /** Site-absolute path (local) or the full URL (remote). */
  src: string;
  source: ManifestImageSource;
  /** Compact 18-char LQIP string: 3 hex colors (TL, TR, BR). */
  lqip: string;
  updatedAt: string;
}

export interface LocalImageEntry extends ImageEntryBase {
  source: 'local';
  /** sha256 of the file contents, used to skip unchanged images. */
  hash: string;
}

export interface RemoteImageEntry extends ImageEntryBase {
  source: 'remote';
  /** HTTP validators, used for conditional revalidation. */
  etag?: string;
  lastModified?: string;
}

export type ImageManifestEntry = LocalImageEntry | RemoteImageEntry;

export interface ImageManifest {
  version: number;
  generatorVersion: number;
  updatedAt: string;
  images: Record<string, ImageManifestEntry>;
}

/** Per-run counters reported by the generator. */
export interface ScanStats {
  scannedFiles: number;
  added: number;
  updated: number;
  reused: number;
  /** Entries removed because their source no longer exists. */
  deleted: number;
  /** Entries preserved because they live under a skipped directory. */
  keptSkipped: number;
  failed: number;
  skippedFormat: number;
}

export function createScanStats(): ScanStats {
  return { scannedFiles: 0, added: 0, updated: 0, reused: 0, deleted: 0, keptSkipped: 0, failed: 0, skippedFormat: 0 };
}

// --------- Path helpers ---------

/**
 * Normalize a path to a `/`-prefixed, forward-slash relative path.
 *
 * Strips the project root, converts backslashes, collapses redundant
 * separators, and guarantees a single leading slash.
 */
export function normalizeRelPath(filePath: string, root = ''): string {
  let rel = filePath.replace(/\\/g, '/');
  const posixRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');

  if (posixRoot) {
    // Tolerate both absolute ("C:/proj/public/x") and relative ("public/x") roots.
    if (rel === posixRoot) rel = '';
    else if (rel.startsWith(`${posixRoot}/`)) rel = rel.slice(posixRoot.length + 1);
    else {
      const tail = posixRoot.replace(/^[A-Za-z]:/, '');
      const idx = tail ? rel.indexOf(`${tail}/`) : -1;
      if (idx !== -1) rel = rel.slice(idx + tail.length + 1);
    }
  }

  return `/${rel}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

/** Site-absolute URL of a file inside `public/`, e.g. `public/img/a.webp` → `/img/a.webp`. */
export function toSitePath(filePath: string, publicDir = DEFAULT_PUBLIC_DIR): string {
  return normalizeRelPath(filePath, publicDir);
}

/** Whether `filePath` lives under `publicDir`. */
export function isUnderPublic(filePath: string, publicDir = DEFAULT_PUBLIC_DIR): boolean {
  const norm = filePath.replace(/\\/g, '/');
  const dir = publicDir.replace(/\\/g, '/').replace(/\/+$/, '');
  if (norm.startsWith(`${dir}/`)) return true;
  const tail = dir.replace(/^[A-Za-z]:/, '');
  return Boolean(tail) && norm.includes(`${tail}/`);
}

/** Lowercased extension without the dot, or an empty string. */
export function getExtension(filePathOrUrl: string): string {
  const clean = filePathOrUrl.split(/[?#]/, 1)[0];
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
}

/** Whether the file/URL extension is one this generator can handle. */
export function isSupportedImage(filePathOrUrl: string): boolean {
  return (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(getExtension(filePathOrUrl));
}

/** Extract `pathname` from a URL, falling back to a manual split for invalid URLs. */
export function getUrlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const slash = withoutScheme.indexOf('/');
    return slash === -1 ? '/' : withoutScheme.slice(slash);
  }
}

// --------- Skip patterns ---------

const regexCache = new Map<string, RegExp>();

/** Convert a simple glob (`*`, `?`, `**`) into a RegExp. Throws on a malformed pattern. */
function globToRegExp(pattern: string): RegExp {
  const cached = regexCache.get(pattern);
  if (cached) return cached;

  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
        // Collapse "**/" so it also matches zero directories.
        if (pattern[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  out += '$';

  try {
    const re = new RegExp(out);
    regexCache.set(pattern, re);
    return re;
  } catch {
    throw new Error(`Invalid skip pattern: ${pattern}`);
  }
}

/**
 * Normalize skip patterns: strip leading/trailing slashes, drop empties, and
 * turn a bare directory name into `**\/<name>/**` so it matches at any depth.
 */
export function normalizeSkipPatterns(patterns: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of patterns ?? []) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) continue;
    out.push(trimmed.includes('/') ? trimmed : `**/${trimmed}/**`);
  }
  return out;
}

/** Strip a leading slash and collapse separators, for pattern matching. */
function rootPrefixPath(relPath: string): string {
  return relPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

/**
 * Whether `relPath` (or any ancestor directory of it) matches one of the patterns.
 *
 * Patterns must already be normalized via {@link normalizeSkipPatterns}.
 */
function matchesSkipPattern(relPath: string, patterns: readonly string[]): boolean {
  if (!patterns.length) return false;

  const segments = rootPrefixPath(relPath).split('/').filter(Boolean);
  const candidates = [segments.join('/')];
  for (let i = 1; i < segments.length; i++) candidates.push(segments.slice(0, i).join('/'));

  return candidates.some((candidate) => candidate && patterns.some((pattern) => globToRegExp(pattern).test(candidate)));
}

/** Whether any key in the manifest is protected by the skip patterns. */
export function isSkippedKey(key: string, patterns: readonly string[]): boolean {
  if (!patterns.length) return false;
  const relPath = /^https?:\/\//i.test(key) ? getUrlPathname(key) : key;
  return matchesSkipPattern(relPath, patterns);
}

// --------- Lookup ---------

/**
 * Resolve a manifest entry for a reference used by components or markdown.
 *
 * Handles site-absolute paths (`/img/a.webp`), bare keys (`img/a.webp`), and
 * remote URLs (`https://…`). Both spellings of a local path are tried, since
 * keys are stored with a leading slash but callers may omit it (or vice versa).
 */
export function lookupImageEntry(manifest: ImageManifest | null, ref: string): ImageManifestEntry | null {
  if (!manifest || !ref) return null;

  const images = manifest.images;
  const direct = images[ref];
  if (direct) return direct;

  if (/^https?:\/\//i.test(ref)) return null;

  // Local reference: keys are stored with a single leading slash.
  const bare = ref.replace(/^\/+/, '');
  return images[`/${bare}`] ?? images[bare] ?? null;
}

// --------- Manifest IO ---------

/** Read and validate the manifest. Returns null when missing, corrupt, or from another version. */
export async function readManifest(
  filePath = DEFAULT_MANIFEST_PATH,
): Promise<{ manifest: ImageManifest | null; reason?: string }> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { manifest: null, reason: 'not-found' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { manifest: null, reason: 'corrupt-json' };
  }

  const candidate = parsed as Partial<ImageManifest> | null;
  if (!candidate || typeof candidate !== 'object' || typeof candidate.images !== 'object' || candidate.images === null) {
    return { manifest: null, reason: 'corrupt-shape' };
  }
  if (candidate.version !== MANIFEST_VERSION) {
    return { manifest: null, reason: `version-mismatch(${String(candidate.version)} != ${MANIFEST_VERSION})` };
  }
  if (candidate.generatorVersion !== GENERATOR_VERSION) {
    return { manifest: null, reason: `generator-mismatch(${String(candidate.generatorVersion)} != ${GENERATOR_VERSION})` };
  }

  return { manifest: candidate as ImageManifest };
}

/** Serialize the manifest with sorted keys so diffs stay stable. */
export async function writeManifest(
  filePath: string,
  manifest: ImageManifest,
  updatedAt = new Date().toISOString(),
): Promise<void> {
  const images: Record<string, ImageManifestEntry> = {};
  for (const key of Object.keys(manifest.images).sort()) {
    images[key] = manifest.images[key];
  }

  const output: ImageManifest = {
    version: MANIFEST_VERSION,
    generatorVersion: GENERATOR_VERSION,
    updatedAt,
    images,
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
}

/** sha256 of a file's contents, used as the local change detector. */
export async function sha256File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return sha256Buffer(buf);
}

/** sha256 of an in-memory buffer; same digest as {@link sha256File}. */
export function sha256Buffer(buffer: Uint8Array): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// --------- Merge ---------

export interface MergeInput {
  /** Scanned entries keyed the same way as the manifest. */
  nextImages: Record<string, ImageManifestEntry>;
  /** Keys of entries that should never be re-fetched (remote validators present, not forced). */
  preservedKeys?: ReadonlySet<string>;
  /** Normalized skip patterns; matching keys are never pruned. */
  skipPatterns?: readonly string[];
  prev?: ImageManifest | null;
}

export interface MergeResult {
  images: Record<string, ImageManifestEntry>;
  deletedKeys: string[];
  keptSkippedKeys: string[];
}

/**
 * Combine previously known entries with freshly scanned ones.
 *
 * - Every scanned entry wins (it is authoritative for this run).
 * - Existing entries are kept when their key is in `preservedKeys`.
 * - Existing entries under a skipped directory are kept and never pruned.
 * - Anything else is treated as removed from its source and dropped.
 */
export function mergeImages({ nextImages, preservedKeys, skipPatterns = [], prev }: MergeInput): MergeResult {
  const images: Record<string, ImageManifestEntry> = { ...nextImages };
  const preserved = preservedKeys ?? new Set<string>();
  const deletedKeys: string[] = [];
  const keptSkippedKeys: string[] = [];

  for (const key of Object.keys(prev?.images ?? {})) {
    if (images[key]) continue;

    if (preserved.has(key)) {
      images[key] = (prev as ImageManifest).images[key];
      continue;
    }

    if (isSkippedKey(key, skipPatterns)) {
      images[key] = (prev as ImageManifest).images[key];
      keptSkippedKeys.push(key);
      continue;
    }

    deletedKeys.push(key);
  }

  return { images, deletedKeys, keptSkippedKeys };
}

// --------- Entry construction ---------

/** Build a local entry from measured values. */
export function createLocalEntry(params: {
  src: string;
  dimensions: ImageDimensions;
  colors: readonly RgbColor[];
  hash: string;
  updatedAt?: string;
}): LocalImageEntry {
  return {
    src: params.src,
    source: 'local',
    width: params.dimensions.width,
    height: params.dimensions.height,
    lqip: formatLqip(params.colors),
    hash: params.hash,
    updatedAt: params.updatedAt ?? new Date().toISOString(),
  };
}

/** Build a remote entry from measured values. */
export function createRemoteEntry(params: {
  src: string;
  dimensions: ImageDimensions;
  colors: readonly RgbColor[];
  etag?: string;
  lastModified?: string;
  updatedAt?: string;
}): RemoteImageEntry {
  const entry: RemoteImageEntry = {
    src: params.src,
    source: 'remote',
    width: params.dimensions.width,
    height: params.dimensions.height,
    lqip: formatLqip(params.colors),
    updatedAt: params.updatedAt ?? new Date().toISOString(),
  };
  if (params.etag) entry.etag = params.etag;
  if (params.lastModified) entry.lastModified = params.lastModified;
  return entry;
}

/** Collision between two different local files mapping to the same manifest key. */
export interface KeyCollision {
  key: string;
  kept: string;
  dropped: string;
}

// --------- Markdown extraction ---------

/** Markdown image syntax: `![alt](src)` / `![alt](<src>)`, stopping before any title. */
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*([^)\s]+)/g;

/** Strip an optional `<…>` wrapper and a trailing markdown title. */
function cleanMarkdownSrc(raw: string): string | null {
  let src = raw.trim().replace(/^<|>$/g, '');
  if (!src) return null;

  // `src "title"` / `src 'title'`: the title starts after whitespace.
  const space = src.search(/\s/);
  if (space !== -1) src = src.slice(0, space);
  if (!src) return null;

  // `![alt](url)` is the only supported form; anything else is a false positive.
  return /^https?:\/\//i.test(src) || src.startsWith('/') ? src : null;
}

export interface ExtractedPostImages {
  /** HTTP(S) URLs referenced by the `cover` frontmatter field. */
  covers: string[];
  /** HTTP(S) URLs referenced by `![alt](src)` in the body. */
  bodyImages: string[];
}

/**
 * Extract remote image references from a post source.
 *
 * Only the `cover` frontmatter field and HTTP(S) `![alt](src)` markdown images
 * are collected; HTML `<img>` tags, relative paths, and placeholders are ignored.
 */
export function extractPostImageRefs(source: string): ExtractedPostImages {
  let frontmatter: Record<string, unknown> = {};
  let body = source;

  try {
    const parsed = matter(source);
    frontmatter = parsed.data as Record<string, unknown>;
    body = parsed.content;
  } catch {
    // Malformed frontmatter: still scan the raw text so nothing is silently lost.
  }

  const covers: string[] = [];
  const cover = frontmatter.cover;
  if (typeof cover === 'string' && /^https?:\/\//i.test(cover.trim())) {
    covers.push(cover.trim());
  }

  const bodyImages: string[] = [];
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  let match = MARKDOWN_IMAGE_RE.exec(body);
  while (match !== null) {
    const src = cleanMarkdownSrc(match[1]);
    if (src && /^https?:\/\//i.test(src)) bodyImages.push(src);
    match = MARKDOWN_IMAGE_RE.exec(body);
  }

  return { covers, bodyImages };
}

// --------- Key collisions ---------

/**
 * Detect two distinct source files resolving to the same site path.
 * The first candidate wins; later ones are reported.
 */
export function detectKeyCollisions(pairs: readonly { key: string; sourcePath: string }[]): KeyCollision[] {
  const seen = new Map<string, string>();
  const collisions: KeyCollision[] = [];

  for (const { key, sourcePath } of pairs) {
    const existing = seen.get(key);
    if (existing === undefined) {
      seen.set(key, sourcePath);
      continue;
    }
    if (existing !== sourcePath) collisions.push({ key, kept: existing, dropped: sourcePath });
  }

  return collisions;
}
