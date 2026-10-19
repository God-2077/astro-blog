/**
 * Unit tests for the image manifest scan scope (content dirs + domain allowlist).
 *
 * Run with: pnpm test:images
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { normalizeSkipPatterns } from './image-manifest';
import {
  buildContentGlob,
  isHostAllowed,
  isSkippedContentFile,
  isUrlAllowed,
  resolveAllowedDomains,
  resolveContentDirs,
  toContentRelative,
} from './scan-scope';

const cwd = process.cwd();

// --------- Content dirs ---------

test('resolveContentDirs defaults to src/content/blog', () => {
  for (const raw of [undefined, null]) {
    const dirs = resolveContentDirs(raw);
    assert.equal(dirs.length, 1);
    assert.equal(dirs[0].label, 'src/content/blog');
    assert.equal(path.isAbsolute(dirs[0].path), true);
    assert.equal(dirs[0].path.endsWith('/src/content/blog'), true);
  }
});

test('resolveContentDirs accepts a single string and paths outside the project', () => {
  const dirs = resolveContentDirs('../astro-blog-content/src/content/blog');

  assert.equal(dirs.length, 1);
  assert.equal(dirs[0].label, '../astro-blog-content/src/content/blog');
  assert.equal(dirs[0].path.endsWith('/astro-blog-content/src/content/blog'), true);
  assert.equal(dirs[0].path.includes('\\'), false);
});

test('resolveContentDirs trims entries and dedupes resolved paths', () => {
  const dirs = resolveContentDirs([' src/content/blog ', './src/content/blog', '']);

  assert.equal(dirs.length, 1);
  assert.equal(dirs[0].label, 'src/content/blog');
});

test('resolveContentDirs keeps multiple distinct dirs in order', () => {
  const dirs = resolveContentDirs(['src/content/blog', '../astro-blog-content/src/content/blog']);

  assert.deepEqual(
    dirs.map((dir) => dir.label),
    ['src/content/blog', '../astro-blog-content/src/content/blog'],
  );
});

test('resolveContentDirs rejects invalid input instead of scanning nothing', () => {
  assert.throws(() => resolveContentDirs(42), /string or a list of strings/);
  assert.throws(() => resolveContentDirs([1]), /string or a list of strings/);
  assert.throws(() => resolveContentDirs([]), /at least one directory/);
  assert.throws(() => resolveContentDirs(['  ']), /at least one directory/);
});

test('buildContentGlob covers md and mdx with forward slashes', () => {
  assert.equal(buildContentGlob('/repo/src/content/blog'), '/repo/src/content/blog/**/*.{md,mdx}');
  assert.equal(buildContentGlob('C:\\repo\\content\\'), 'C:/repo/content/**/*.{md,mdx}');
});

test('toContentRelative returns slash-separated paths inside the content dir', () => {
  const dir = path.resolve('content/blog');
  const file = path.join(dir, 'ja', 'post.md');

  assert.equal(toContentRelative(file, dir), 'ja/post.md');
});

test('isSkippedContentFile matches content-relative and project-relative patterns', () => {
  const dir = path.resolve('content/blog');
  const file = path.join(dir, 'ja', 'post.md');

  assert.equal(isSkippedContentFile(file, dir, normalizeSkipPatterns(['ja'])), true);
  assert.equal(isSkippedContentFile(file, dir, normalizeSkipPatterns([path.relative(cwd, dir)])), true);
  assert.equal(isSkippedContentFile(file, dir, normalizeSkipPatterns(['other'])), false);
  assert.equal(isSkippedContentFile(file, dir, []), false);
});

// --------- Domain allowlist ---------

test('resolveAllowedDomains treats missing or empty config as unrestricted', () => {
  for (const raw of [undefined, null, [], '', ['  ']]) {
    const allowlist = resolveAllowedDomains(raw);

    assert.equal(allowlist.restricted, false);
    assert.deepEqual(allowlist.patterns, []);
    assert.equal(isUrlAllowed('https://anything.example/x.jpg', allowlist), true);
    assert.equal(isHostAllowed('anything.example', allowlist), true);
  }
});

test('resolveAllowedDomains normalizes scheme, path, port, case and wildcards', () => {
  const allowlist = resolveAllowedDomains([' HTTPS://CDN.Example.com:8443/path ', '.example.org', '*.foo.net']);

  assert.equal(allowlist.restricted, true);
  assert.deepEqual(allowlist.patterns, ['cdn.example.com', '*.example.org', '*.foo.net']);
});

test('resolveAllowedDomains rejects invalid input', () => {
  assert.throws(() => resolveAllowedDomains(42), /string or a list of strings/);
  assert.throws(() => resolveAllowedDomains([1]), /string or a list of strings/);
  assert.throws(() => resolveAllowedDomains(['https://']), /at least one hostname/);
});

test('resolveAllowedDomains dedupes patterns', () => {
  const allowlist = resolveAllowedDomains(['cdn.example.com', 'https://cdn.example.com/a.png']);

  assert.deepEqual(allowlist.patterns, ['cdn.example.com']);
});

test('isUrlAllowed matches exact hosts only', () => {
  const allowlist = resolveAllowedDomains(['cdn.example.com']);

  assert.equal(isUrlAllowed('https://cdn.example.com/a.jpg', allowlist), true);
  assert.equal(isUrlAllowed('https://img.cdn.example.com/a.jpg', allowlist), false);
  assert.equal(isUrlAllowed('https://cdn.example.com.evil.com/a.jpg', allowlist), false);
  assert.equal(isUrlAllowed('https://evil.com/cdn.example.com/a.jpg', allowlist), false);
});

test('isUrlAllowed matches subdomain wildcards but not the apex', () => {
  const allowlist = resolveAllowedDomains(['*.example.org']);

  assert.equal(isUrlAllowed('https://a.example.org/a.jpg', allowlist), true);
  assert.equal(isUrlAllowed('https://a.b.example.org/a.jpg', allowlist), true);
  assert.equal(isUrlAllowed('https://example.org/a.jpg', allowlist), false);
});

test('isUrlAllowed rejects malformed and non-http urls when restricted', () => {
  const allowlist = resolveAllowedDomains(['cdn.example.com']);

  assert.equal(isUrlAllowed('not a url', allowlist), false);
  assert.equal(isUrlAllowed('ftp://cdn.example.com/a.jpg', allowlist), false);
});

test('a bare * allows every host', () => {
  const allowlist = resolveAllowedDomains('*');

  assert.equal(allowlist.restricted, true);
  assert.equal(isHostAllowed('anything.example', allowlist), true);
  assert.equal(isUrlAllowed('https://anything.example/a.jpg', allowlist), true);
});

test('host matching ignores case and trailing dots', () => {
  const allowlist = resolveAllowedDomains(['CDN.Example.com']);

  assert.equal(isHostAllowed('cdn.example.com.', allowlist), true);
  assert.equal(isHostAllowed('CDN.EXAMPLE.COM', allowlist), true);
});
