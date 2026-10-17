/**
 * Unit tests for the image manifest core logic.
 *
 * Run with: pnpm test:images
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImageManifest, ImageManifestEntry, LocalImageEntry, RemoteImageEntry } from './image-manifest';
import {
  detectKeyCollisions,
  extractPostImageRefs,
  getExtension,
  getUrlPathname,
  isSkippedKey,
  isSupportedImage,
  isUnderPublic,
  lookupImageEntry,
  mergeImages,
  normalizeRelPath,
  normalizeSkipPatterns,
  toSitePath,
} from './image-manifest';
import { formatLqip, lqipToGradient, parseLqip } from './lqip-color';

function localEntry(src: string, overrides: Partial<LocalImageEntry> = {}): LocalImageEntry {
  return {
    src,
    source: 'local',
    width: 100,
    height: 50,
    lqip: 'aabbccddeeff001122',
    hash: 'deadbeef',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function remoteEntry(src: string, overrides: Partial<RemoteImageEntry> = {}): RemoteImageEntry {
  return {
    src,
    source: 'remote',
    width: 800,
    height: 600,
    lqip: '112233445566778899',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function manifestOf(images: Record<string, ImageManifestEntry>): ImageManifest {
  return { version: 1, generatorVersion: 1, updatedAt: '2026-01-01T00:00:00.000Z', images };
}

// --------- Path helpers ---------

test('normalizeRelPath converts Windows separators and strips the root prefix', () => {
  assert.equal(normalizeRelPath('public\\img\\cover\\1.webp', 'public'), '/img/cover/1.webp');
  assert.equal(normalizeRelPath('public/img/cover/1.webp', 'public'), '/img/cover/1.webp');
  assert.equal(normalizeRelPath('C:\\proj\\public\\img\\a.webp', 'C:\\proj\\public'), '/img/a.webp');
  assert.equal(normalizeRelPath('public/a.webp', 'public'), '/a.webp');
});

test('normalizeRelPath collapses redundant separators', () => {
  assert.equal(normalizeRelPath('public//img///a.webp', 'public'), '/img/a.webp');
});

test('toSitePath maps files under public/ to site-absolute paths', () => {
  assert.equal(toSitePath('public/img/cover.webp'), '/img/cover.webp');
  assert.equal(toSitePath('public/robots.png'), '/robots.png');
  assert.equal(toSitePath('public\\img\\cover.webp'), '/img/cover.webp');
});

test('isUnderPublic detects membership including absolute roots', () => {
  assert.equal(isUnderPublic('public/img/a.webp'), true);
  assert.equal(isUnderPublic('C:\\proj\\public\\img\\a.webp', 'public'), true);
  assert.equal(isUnderPublic('src/assets/a.webp', 'public'), false);
});

test('getExtension handles query strings and dotfiles', () => {
  assert.equal(getExtension('https://a/b.PNG'), 'png');
  assert.equal(getExtension('https://a/b.webp?x=1'), 'webp');
  assert.equal(getExtension('/img/no-extension'), '');
});

test('isSupportedImage accepts webp/jpg/jpeg/png only', () => {
  for (const src of ['a.webp', 'a.jpg', 'a.jpeg', 'a.png', 'https://a/b.JPG']) {
    assert.equal(isSupportedImage(src), true, src);
  }
  for (const src of ['a.gif', 'a.svg', 'a.avif', 'a.webp.avif', 'a']) {
    assert.equal(isSupportedImage(src), false, src);
  }
});

test('getUrlPathname falls back for malformed URLs', () => {
  assert.equal(getUrlPathname('https://a.com/x/y.jpg?q=1'), '/x/y.jpg');
  // Without a scheme, `new URL` still resolves a pathname…
  assert.equal(getUrlPathname('not-a-url/x.jpg'), '/x.jpg');
  // …while a genuinely unparseable URL takes the manual fallback.
  assert.equal(getUrlPathname('http://[invalid/img/a.jpg'), '/img/a.jpg');
});

// --------- Skip patterns ---------

test('normalizeSkipPatterns turns bare names into nested globs', () => {
  assert.deepEqual(normalizeSkipPatterns(['astro-koharu']), ['**/astro-koharu/**']);
  assert.deepEqual(normalizeSkipPatterns(['img/cover/*']), ['img/cover/*']);
  assert.deepEqual(normalizeSkipPatterns(['/img/cover/']), ['img/cover']);
  assert.deepEqual(normalizeSkipPatterns(['  img/cover  ']), ['img/cover']);
  assert.deepEqual(normalizeSkipPatterns(['', '   ', undefined as unknown as string]), []);
});

test('matchesSkipPattern handles bare directory names at any depth', () => {
  const patterns = normalizeSkipPatterns(['astro-koharu']);
  assert.equal(isSkippedKey('/img/cover/astro-koharu/1.webp', patterns), true);
  assert.equal(isSkippedKey('/deep/nested/astro-koharu/a/b.webp', patterns), true);
  assert.equal(isSkippedKey('/img/cover/other/1.webp', patterns), false);
  // Prefix must not match a different directory name.
  assert.equal(isSkippedKey('/img/cover/astro-koharu2/1.webp', patterns), false);
});

test('matchesSkipPattern handles relative paths', () => {
  const patterns = normalizeSkipPatterns(['img/cover/astro-koharu']);
  assert.equal(isSkippedKey('/img/cover/astro-koharu/1.webp', patterns), true);
  assert.equal(isSkippedKey('/img/cover/astro-koharu', patterns), true);
  assert.equal(isSkippedKey('/img/cover/Traum/1.webp', patterns), false);
});

test('matchesSkipPattern handles globs', () => {
  const patterns = normalizeSkipPatterns(['img/cover/*']);
  // A direct child matches…
  assert.equal(isSkippedKey('/img/cover/a/1.webp', patterns), true);
  // …and the ancestor segment does too, so deeper files are skipped as well.
  assert.equal(isSkippedKey('/img/cover/a/b/1.webp', patterns), true);
  assert.equal(isSkippedKey('/img/other/1.webp', patterns), false);

  const question = normalizeSkipPatterns(['img/c?ver']);
  assert.equal(isSkippedKey('/img/cover/1.webp', question), true);
  assert.equal(isSkippedKey('/img/caver/1.webp', question), true);
  assert.equal(isSkippedKey('/img/coover/1.webp', question), false);
});

test('matchesSkipPattern matches remote URLs by pathname only', () => {
  const patterns = normalizeSkipPatterns(['img/cover']);
  assert.equal(isSkippedKey('https://cdn.example.com/img/cover/a.jpg', patterns), true);
  assert.equal(isSkippedKey('https://cdn.example.com/other/a.jpg', patterns), false);
  // The host must not influence matching.
  const hostPattern = normalizeSkipPatterns(['cdn.example.com']);
  assert.equal(isSkippedKey('https://cdn.example.com/a.jpg', hostPattern), false);
});

test('normalizeSkipPatterns escapes regex metacharacters', () => {
  const patterns = normalizeSkipPatterns(['img/a+b']);
  assert.equal(isSkippedKey('/img/a+b/1.webp', patterns), true);
  assert.equal(isSkippedKey('/img/aab/1.webp', patterns), false);

  const dotted = normalizeSkipPatterns(['img/v1.0']);
  assert.equal(isSkippedKey('/img/v1.0/1.webp', dotted), true);
  assert.equal(isSkippedKey('/img/v1x0/1.webp', dotted), false);
});

test('empty skip list skips nothing', () => {
  assert.equal(isSkippedKey('/anything/here.webp', []), false);
});

// --------- Lookup ---------

test('lookupImageEntry resolves site paths, bare keys and URLs', () => {
  const manifest = manifestOf({
    '/img/cover.webp': localEntry('/img/cover.webp'),
    'https://a.com/b.jpg': remoteEntry('https://a.com/b.jpg'),
  });

  assert.equal(lookupImageEntry(manifest, '/img/cover.webp')?.src, '/img/cover.webp');
  assert.equal(lookupImageEntry(manifest, 'img/cover.webp')?.src, '/img/cover.webp');
  assert.equal(lookupImageEntry(manifest, 'https://a.com/b.jpg')?.src, 'https://a.com/b.jpg');
  assert.equal(lookupImageEntry(manifest, '/img/missing.webp'), null);
  assert.equal(lookupImageEntry(manifest, 'https://a.com/missing.jpg'), null);
  assert.equal(lookupImageEntry(null, '/img/cover.webp'), null);
  assert.equal(lookupImageEntry(manifest, ''), null);
});

test('lookupImageEntry matches keys stored with a leading slash from either spelling', () => {
  // Keys derived from the file path (vfile-resolved markdown refs) keep the slash.
  const manifest = manifestOf({
    '/src/content/blog/note/local.webp': localEntry('/src/content/blog/note/local.webp'),
  });

  assert.equal(lookupImageEntry(manifest, '/src/content/blog/note/local.webp')?.src, '/src/content/blog/note/local.webp');
  assert.equal(lookupImageEntry(manifest, 'src/content/blog/note/local.webp')?.src, '/src/content/blog/note/local.webp');
});

// --------- Merge ---------

test('mergeImages drops entries whose source disappeared', () => {
  const prev = manifestOf({ '/img/gone.webp': localEntry('/img/gone.webp') });
  const kept = localEntry('/img/kept.webp');

  const result = mergeImages({ nextImages: { '/img/kept.webp': kept }, prev });

  assert.deepEqual(Object.keys(result.images), ['/img/kept.webp']);
  assert.deepEqual(result.deletedKeys, ['/img/gone.webp']);
});

test('mergeImages preserves remote entries when the feature is disabled', () => {
  const prev = manifestOf({
    '/local.webp': localEntry('/local.webp'),
    'https://a.com/b.jpg': remoteEntry('https://a.com/b.jpg'),
  });

  const result = mergeImages({
    nextImages: { '/local.webp': prev.images['/local.webp'] },
    preservedKeys: new Set(['https://a.com/b.jpg']),
    prev,
  });

  assert.deepEqual(Object.keys(result.images).sort(), ['/local.webp', 'https://a.com/b.jpg'].sort());
  assert.deepEqual(result.deletedKeys, []);
});

test('mergeImages keeps entries under skipped directories', () => {
  const prev = manifestOf({
    '/img/cover/skipme/1.webp': localEntry('/img/cover/skipme/1.webp'),
    '/img/cover/dropme/1.webp': localEntry('/img/cover/dropme/1.webp'),
  });

  const result = mergeImages({
    nextImages: {},
    skipPatterns: normalizeSkipPatterns(['skipme']),
    prev,
  });

  assert.deepEqual(Object.keys(result.images), ['/img/cover/skipme/1.webp']);
  assert.deepEqual(result.keptSkippedKeys, ['/img/cover/skipme/1.webp']);
  assert.deepEqual(result.deletedKeys, ['/img/cover/dropme/1.webp']);
});

test('mergeImages keeps remote entries under a skipped URL path', () => {
  const prev = manifestOf({
    'https://cdn.example.com/skipme/a.jpg': remoteEntry('https://cdn.example.com/skipme/a.jpg'),
    'https://cdn.example.com/keepme/a.jpg': remoteEntry('https://cdn.example.com/keepme/a.jpg'),
  });

  const result = mergeImages({ nextImages: {}, skipPatterns: normalizeSkipPatterns(['skipme']), prev });

  assert.deepEqual(Object.keys(result.images), ['https://cdn.example.com/skipme/a.jpg']);
  assert.deepEqual(result.deletedKeys, ['https://cdn.example.com/keepme/a.jpg']);
});

test('mergeImages lets scanned entries win over previous ones', () => {
  const prev = manifestOf({ '/a.webp': localEntry('/a.webp', { width: 1 }) });
  const fresh = localEntry('/a.webp', { width: 2, hash: 'newhash' });

  const result = mergeImages({ nextImages: { '/a.webp': fresh }, prev });

  assert.equal(result.images['/a.webp'].width, 2);
  assert.deepEqual(result.deletedKeys, []);
});

test('mergeImages with no previous manifest returns scanned entries', () => {
  const result = mergeImages({ nextImages: { '/a.webp': localEntry('/a.webp') }, prev: null });
  assert.deepEqual(Object.keys(result.images), ['/a.webp']);
  assert.deepEqual(result.deletedKeys, []);
});

// --------- Collisions ---------

test('detectKeyCollisions reports distinct files sharing one site path', () => {
  const collisions = detectKeyCollisions([
    { key: '/img/foo.jpg', sourcePath: 'public/img/foo.jpg' },
    { key: '/img/foo.jpg', sourcePath: 'public/foo.jpg' },
    { key: '/img/bar.jpg', sourcePath: 'public/img/bar.jpg' },
  ]);

  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0], { key: '/img/foo.jpg', kept: 'public/img/foo.jpg', dropped: 'public/foo.jpg' });
});

test('detectKeyCollisions ignores the same file listed twice', () => {
  const collisions = detectKeyCollisions([
    { key: '/img/foo.jpg', sourcePath: 'public/img/foo.jpg' },
    { key: '/img/foo.jpg', sourcePath: 'public/img/foo.jpg' },
  ]);
  assert.deepEqual(collisions, []);
});

// --------- Markdown extraction ---------

test('extractPostImageRefs reads remote covers and body images', () => {
  const source = [
    '---',
    'title: Hello',
    'cover: https://cdn.example.com/cover.jpg',
    '---',
    '',
    'Text ![alt](https://cdn.example.com/a.png) more',
    '![b](<https://cdn.example.com/b.webp>)',
    "![c](https://cdn.example.com/c.jpg 'A title')",
  ].join('\n');

  const result = extractPostImageRefs(source);

  assert.deepEqual(result.covers, ['https://cdn.example.com/cover.jpg']);
  assert.deepEqual(result.bodyImages, [
    'https://cdn.example.com/a.png',
    'https://cdn.example.com/b.webp',
    'https://cdn.example.com/c.jpg',
  ]);
});

test('extractPostImageRefs ignores local covers and non-HTTP references', () => {
  const source = ['---', 'cover: /img/local.webp', '---', '', '![a](/img/local.png)', '![b](img/relative.png)'].join('\n');

  const result = extractPostImageRefs(source);

  assert.deepEqual(result.covers, []);
  assert.deepEqual(result.bodyImages, []);
});

test('extractPostImageRefs skips unfilled placeholders', () => {
  const source = ['---', 'title: x', '---', '', '![图片链接](图片链接)', '![a]({content})', '![b]()'].join('\n');

  const result = extractPostImageRefs(source);

  assert.deepEqual(result.bodyImages, []);
});

test('extractPostImageRefs handles missing frontmatter and duplicate refs', () => {
  const source = '![x](https://a.com/1.png) and ![y](https://a.com/1.png)';
  const result = extractPostImageRefs(source);

  assert.deepEqual(result.covers, []);
  assert.deepEqual(result.bodyImages, ['https://a.com/1.png', 'https://a.com/1.png']);
});

// --------- LQIP color helpers ---------

test('formatLqip and parseLqip round-trip', () => {
  const colors = [
    { r: 225, g: 160, b: 163 },
    { r: 213, g: 142, b: 150 },
    { r: 213, g: 161, b: 169 },
  ];
  const compact = formatLqip(colors);

  assert.equal(compact, 'e1a0a3d58e96d5a1a9');
  assert.deepEqual(parseLqip(compact), ['#e1a0a3', '#d58e96', '#d5a1a9']);
});

test('formatLqip clamps and rounds out-of-range channels', () => {
  assert.equal(formatLqip([{ r: 300, g: -5, b: 127.6 }]), 'ff0080');
});

test('parseLqip rejects malformed values', () => {
  for (const bad of [undefined, null, '', 'abc', 'e1a0a3d58e96d5a1a', 'E1A0A3D58E96D5A1A9', 'e1a0a3d58e96d5a1zz']) {
    assert.equal(parseLqip(bad), null, String(bad));
  }
});

test('lqipToGradient builds the expected CSS value', () => {
  assert.equal(lqipToGradient('e1a0a3d58e96d5a1a9'), 'linear-gradient(135deg, #e1a0a3 0%, #d58e96 50%, #d5a1a9 100%)');
  assert.equal(lqipToGradient('nope'), undefined);
});
