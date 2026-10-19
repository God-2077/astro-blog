/**
 * Scan scope for the image manifest generator.
 *
 * Two independent scopes are resolved from `config/site.yaml`:
 *
 * 1. Content sources — which directories hold posts and are therefore scanned
 *    for `cover` / `![alt](src)` image references (`imageManifest.contentDirs`,
 *    default `src/content/blog`).
 * 2. External image allowlist — which remote hostnames may be fetched
 *    (`imageManifest.allowedDomains`; empty means "no restriction").
 *
 * Everything here is free of filesystem access, so it can be unit tested
 * without touching disk or the network.
 */

import path from 'node:path';
import { isSkippedKey } from './image-manifest';

/** Directories scanned for post image references when none are configured. */
const DEFAULT_CONTENT_DIRS = ['src/content/blog'] as const;

/** Post file extensions scanned inside every configured content directory. */
const CONTENT_FILE_EXTENSIONS = ['md', 'mdx'] as const;

export interface ContentDir {
  /** Absolute, `/`-separated directory path (ready to build a glob from). */
  path: string;
  /** Label used in logs: the configured value as written by the user. */
  label: string;
}

/** Normalize a filesystem path to `/` separators without a trailing slash. */
function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Accept a scalar or a list of strings, rejecting everything else. */
function toStringList(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (typeof raw === 'string') return [raw];
  if (!Array.isArray(raw)) throw new Error('must be a string or a list of strings');

  return raw.map((value) => {
    if (typeof value !== 'string') throw new Error('must be a string or a list of strings');
    return value;
  });
}

/** Resolve configured values into absolute, de-duplicated content dirs. */
function buildContentDirs(values: readonly string[], cwd: string): ContentDir[] {
  const dirs: ContentDir[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const resolved = toPosix(path.resolve(cwd, value));
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    dirs.push({ path: resolved, label: value });
  }

  return dirs;
}

/**
 * Resolve `imageManifest.contentDirs` into the directories to scan.
 *
 * Accepts a single string or a list of strings; relative entries resolve from
 * the project root and may point outside it (e.g.
 * `../astro-blog-content/src/content/blog`). An explicit empty entry or list is
 * a configuration error: it would otherwise silently scan nothing.
 */
export function resolveContentDirs(raw: unknown, cwd: string = process.cwd()): ContentDir[] {
  if (raw === undefined || raw === null) return buildContentDirs(DEFAULT_CONTENT_DIRS, cwd);

  const values = toStringList(raw)
    .map((value) => value.trim())
    .filter(Boolean);

  if (!values.length) throw new Error('must contain at least one directory');

  const dirs = buildContentDirs(values, cwd);
  if (!dirs.length) throw new Error('must contain at least one directory');

  return dirs;
}

/** Glob pattern for every post file under `dir`. */
export function buildContentGlob(dir: string): string {
  return `${toPosix(dir)}/**/*.{${CONTENT_FILE_EXTENSIONS.join(',')}}`;
}

/** Path of `filePath` relative to `dir`, using `/` separators. */
export function toContentRelative(filePath: string, dir: string): string {
  const relative = path.relative(path.resolve(dir), path.resolve(filePath));
  return toPosix(relative).replace(/^\/+/, '');
}

/**
 * Whether a content file sits under one of the skip patterns.
 *
 * Both spellings are tested so existing configs keep working:
 * - relative to the configured content dir (`ja/foo.md`), and
 * - relative to the project root (`src/content/blog/ja/foo.md`, or
 *   `../astro-blog-content/...` when the content lives outside the project).
 */
export function isSkippedContentFile(
  filePath: string,
  dir: string,
  patterns: readonly string[],
  cwd: string = process.cwd(),
): boolean {
  if (!patterns.length) return false;

  const absolute = path.resolve(filePath);
  const candidates = new Set([toContentRelative(absolute, dir), toPosix(path.relative(path.resolve(cwd), absolute))]);

  for (const candidate of candidates) {
    if (candidate && isSkippedKey(candidate, patterns)) return true;
  }

  return false;
}

export interface DomainAllowlist {
  /** False when no restriction is configured: every host is allowed. */
  restricted: boolean;
  /** Normalized patterns: exact hostnames, `*.suffix`, or `*`. */
  patterns: string[];
}

/** Lowercase a configured domain and strip scheme, path, port and wildcard sugar. */
function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');

  const slash = value.indexOf('/');
  if (slash !== -1) value = value.slice(0, slash);

  value = value.replace(/:\d+$/, '').replace(/\.+$/, '');
  if (value.startsWith('.')) value = `*${value}`;

  return value;
}

/**
 * Resolve `imageManifest.allowedDomains`.
 *
 * Missing/empty config means "no restriction" (backwards compatible). Entries
 * are forgiving (`https://CDN.example.com:8443/a.png` → `cdn.example.com`);
 * `*.example.com` matches subdomains only, `*` matches every host.
 */
export function resolveAllowedDomains(raw: unknown): DomainAllowlist {
  const configured = toStringList(raw);
  const normalized = configured.map(normalizeDomain).filter(Boolean);

  if (!normalized.length) {
    if (configured.some((value) => value.trim() !== '')) {
      throw new Error('must contain at least one hostname');
    }
    return { restricted: false, patterns: [] };
  }

  return { restricted: true, patterns: [...new Set(normalized)] };
}

/** Whether a hostname is covered by the allowlist. */
export function isHostAllowed(hostname: string, allowlist: DomainAllowlist): boolean {
  if (!allowlist.restricted) return true;

  const host = hostname.trim().toLowerCase().replace(/\.+$/, '');
  if (!host) return false;

  return allowlist.patterns.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1));
    return host === pattern;
  });
}

/** Whether an HTTP(S) URL may be fetched under the allowlist. */
export function isUrlAllowed(url: string, allowlist: DomainAllowlist): boolean {
  if (!allowlist.restricted) return true;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isHostAllowed(parsed.hostname, allowlist);
  } catch {
    return false;
  }
}
