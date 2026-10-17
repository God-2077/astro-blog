/**
 * Unit tests for the rehype image placeholder plugin.
 *
 * The plugin is driven with an injected manifest lookup so the assertions do not
 * depend on generated `src/assets/image-manifest.json` contents.
 *
 * Run with: pnpm test:images
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImageManifestEntry } from '../../scripts/lib/image-manifest';
import { rehypeImagePlaceholder } from './rehype-image-placeholder';

const LQIP = 'e1a0a3d58e96d5a1a9';
const EXPECTED_GRADIENT = 'linear-gradient(135deg, #e1a0a3 0%, #d58e96 50%, #d5a1a9 100%)';

function entry(src: string, overrides: Partial<ImageManifestEntry> = {}): ImageManifestEntry {
  return {
    src,
    source: 'remote',
    width: 800,
    height: 600,
    lqip: LQIP,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ImageManifestEntry;
}

interface Node {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

function makeImage(properties: Record<string, unknown>): Node {
  return { type: 'element', tagName: 'img', properties, children: [] };
}

function makeTree(...children: Node[]): Node {
  return { type: 'root', children };
}

function makeParagraph(...children: Node[]): Node {
  return { type: 'element', tagName: 'p', properties: {}, children };
}

function makeLink(href: string, ...children: Node[]): Node {
  return { type: 'element', tagName: 'a', properties: { href }, children };
}

/** Run the plugin over a tree, with an optional vfile path for relative srcs. */
async function run(
  tree: Node,
  manifest: Record<string, ImageManifestEntry> = {},
  vfilePath = 'src/content/blog/post/example.md',
): Promise<Node> {
  const plugin = rehypeImagePlaceholder({
    readManifest: (src: string) => manifest[src] ?? null,
  });
  await plugin(tree as never, { path: vfilePath });
  return tree;
}

function findFirst(node: Node, tagName: string): Node | null {
  if (node.tagName === tagName) return node;
  for (const child of node.children ?? []) {
    const found = findFirst(child, tagName);
    if (found) return found;
  }
  return null;
}

function collect(node: Node, tagName: string, out: Node[] = []): Node[] {
  if (node.tagName === tagName) out.push(node);
  for (const child of node.children ?? []) collect(child, tagName, out);
  return out;
}

// --------- Enrichment ---------

test('enriches a matching image with dimensions and a gradient', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const tree = makeTree(makeParagraph(makeImage({ src, alt: 'A picture' })));

  await run(tree, { [src]: entry(src) });

  const img = findFirst(tree, 'img');
  assert.ok(img, 'img should still exist');
  assert.equal(img?.properties?.width, 800);
  assert.equal(img?.properties?.height, 600);
  assert.equal(img?.properties?.style, `background-image:${EXPECTED_GRADIENT}`);
  assert.equal(img?.properties?.loading, 'lazy');
  assert.equal(img?.properties?.decoding, 'async');
  assert.equal(img?.properties?.class, 'markdown-image');
  assert.equal(img?.properties?.alt, 'A picture');

  const figure = findFirst(tree, 'figure');
  assert.ok(figure, 'image should be wrapped in a figure');
  assert.equal(figure?.properties?.class, 'markdown-image-wrapper');
  assert.equal(figure?.properties?.style, `background-image:${EXPECTED_GRADIENT};--img-ratio:1.333333`);
  assert.equal(findFirst(tree, 'figcaption')?.children?.[0]?.value, 'A picture');
});

test('writes the manifest aspect ratio onto the wrapper', async () => {
  const src = 'https://cdn.example.com/wide.jpg';
  const tree = makeTree(makeParagraph(makeImage({ src })));

  await run(tree, { [src]: entry(src, { width: 3840, height: 2160 }) });

  const figure = findFirst(tree, 'figure');
  assert.equal(figure?.properties?.style, `background-image:${EXPECTED_GRADIENT};--img-ratio:1.777778`);
});

test('does not override author-specified dimensions', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const tree = makeTree(makeParagraph(makeImage({ src, width: 10, height: 20 })));

  await run(tree, { [src]: entry(src) });

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, 10);
  assert.equal(img?.properties?.height, 20);
  // The gradient is still applied.
  assert.equal(img?.properties?.style, `background-image:${EXPECTED_GRADIENT}`);

  // The wrapper must reserve the author's ratio, not the manifest's, because
  // the author's dimensions win for the img's intrinsic ratio as well.
  const figure = findFirst(tree, 'figure');
  assert.equal(figure?.properties?.style, `background-image:${EXPECTED_GRADIENT};--img-ratio:0.5`);
});

test('uses author dimensions for the wrapper ratio without a manifest entry', async () => {
  const tree = makeTree(makeParagraph(makeImage({ src: 'https://cdn.example.com/local.jpg', width: 1080, height: 1920 })));

  await run(tree, {});

  const figure = findFirst(tree, 'figure');
  assert.equal(figure?.properties?.style, '--img-ratio:0.5625');
  // No gradient without a manifest entry.
  assert.equal(findFirst(tree, 'img')?.properties?.style, undefined);
});

test('omits the wrapper ratio when no valid dimensions are known', async () => {
  const tree = makeTree(makeParagraph(makeImage({ src: 'https://cdn.example.com/unknown.jpg' })));

  await run(tree, {});

  assert.equal(findFirst(tree, 'figure')?.properties?.style, undefined);
});

test('leaves an image without a manifest entry untouched except lazy attrs', async () => {
  const tree = makeTree(makeParagraph(makeImage({ src: 'https://cdn.example.com/unknown.jpg' })));

  await run(tree, {});

  const img = findFirst(tree, 'img');
  assert.ok(img);
  assert.equal(img?.properties?.width, undefined);
  assert.equal(img?.properties?.height, undefined);
  assert.equal(img?.properties?.style, undefined);
  assert.equal(img?.properties?.class, 'markdown-image');

  const figure = findFirst(tree, 'figure');
  assert.ok(figure);
  assert.equal(figure?.properties?.style, undefined);
});

test('enriches relative srcs resolved against the markdown file', async () => {
  const resolved = 'src/content/blog/post/local.webp';
  const tree = makeTree(makeParagraph(makeImage({ src: './local.webp' })));

  await run(tree, { [resolved]: entry(resolved, { source: 'local' }) });

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, 800);
  assert.equal(img?.properties?.height, 600);
  assert.equal(img?.properties?.style, `background-image:${EXPECTED_GRADIENT}`);
});

test('resolves relative srcs when the markdown path is absolute', async () => {
  const resolved = 'src/content/blog/post/photo.webp';
  const tree = makeTree(makeParagraph(makeImage({ src: './photo.webp' })));
  const absoluteVfilePath = `${process.cwd().replace(/\\/g, '/')}/src/content/blog/post/example.md`;

  await run(tree, { [resolved]: entry(resolved, { source: 'local' }) }, absoluteVfilePath);

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, 800);
  assert.equal(img?.properties?.height, 600);
  assert.equal(img?.properties?.style, `background-image:${EXPECTED_GRADIENT}`);
});

test('resolves parent-relative srcs', async () => {
  const resolved = 'src/content/blog/post/photo.webp';
  const tree = makeTree(makeParagraph(makeImage({ src: '../post/photo.webp' })));

  await run(tree, { [resolved]: entry(resolved, { source: 'local' }) }, 'src/content/blog/note/example.md');

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, 800);
});

test('ignores relative srcs when the markdown path is unknown', async () => {
  const tree = makeTree(makeParagraph(makeImage({ src: './local.webp' })));

  const plugin = rehypeImagePlaceholder({
    readManifest: (src: string) => (src === 'src/content/blog/post/local.webp' ? entry(src) : null),
  });
  await plugin(tree as never, {});

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, undefined);
  assert.equal(img?.properties?.style, undefined);
});

test('resolves site-absolute srcs without touching the vfile path', async () => {
  const src = '/img/cover/1.webp';
  const tree = makeTree(makeParagraph(makeImage({ src })));

  await run(tree, { [src]: entry(src, { source: 'local' }) }, 'src/content/blog/other/deep/file.md');

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, 800);
  assert.equal(img?.properties?.style, `background-image:${EXPECTED_GRADIENT}`);
});

// --------- Link wrapping ---------

test('does not wrap images inside links but still enriches them', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const tree = makeTree(makeParagraph(makeLink('https://example.com', makeImage({ src }))));

  await run(tree, { [src]: entry(src) });

  assert.equal(findFirst(tree, 'figure'), null);
  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, 800);
  assert.equal(img?.properties?.height, 600);
  assert.equal(img?.properties?.style, `background-image:${EXPECTED_GRADIENT}`);
  assert.equal(img?.properties?.loading, 'lazy');
  // The link branch must not add the figure-only class.
  assert.equal(img?.properties?.class, undefined);
});

// --------- Structure / regression ---------

test('unwraps paragraphs that only contain figures', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const root = makeTree(makeParagraph(makeImage({ src, alt: 'x' })));

  await run(root, { [src]: entry(src) });

  assert.equal(root.children?.length, 1);
  assert.equal(root.children?.[0]?.tagName, 'figure');
});

test('keeps paragraphs that contain more than an image', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const root = makeTree(makeParagraph(makeImage({ src }), { type: 'text', value: 'trailing text' }));

  await run(root, { [src]: entry(src) });

  assert.equal(root.children?.[0]?.tagName, 'p');
  assert.ok(findFirst(root, 'figure'));
});

test('does not re-wrap images that are already inside a figure', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const figure: Node = {
    type: 'element',
    tagName: 'figure',
    properties: { class: 'custom-figure' },
    children: [makeImage({ src })],
  };
  const tree = makeTree(figure);

  await run(tree, { [src]: entry(src) });

  assert.equal(collect(tree, 'figure').length, 1);
  assert.equal(collect(tree, 'figure')[0].properties?.class, 'custom-figure');
  // Images already in a figure are skipped entirely.
  assert.equal(findFirst(tree, 'img')?.properties?.style, undefined);
});

test('omits the caption when the alt text is empty', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const tree = makeTree(makeParagraph(makeImage({ src, alt: '   ' })));

  await run(tree, { [src]: entry(src) });

  assert.equal(findFirst(tree, 'figcaption'), null);
  assert.ok(findFirst(tree, 'figure'));
});

test('can be disabled entirely with useManifest: false', async () => {
  const src = 'https://cdn.example.com/a.jpg';
  const tree = makeTree(makeParagraph(makeImage({ src })));

  const plugin = rehypeImagePlaceholder({ useManifest: false, readManifest: () => entry(src) });
  await plugin(tree as never, { path: 'src/content/blog/post/example.md' });

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, undefined);
  assert.equal(img?.properties?.style, undefined);
  // Wrapping behaviour is unchanged.
  assert.ok(findFirst(tree, 'figure'));
});

test('ignores images with a non-string src', async () => {
  const tree = makeTree(makeParagraph(makeImage({ src: undefined })));

  await run(tree, {});

  assert.equal(findFirst(tree, 'img')?.properties?.style, undefined);
  assert.ok(findFirst(tree, 'figure'));
});

test('enriches every image when a document contains several', async () => {
  const first = 'https://cdn.example.com/1.jpg';
  const second = 'https://cdn.example.com/2.jpg';
  const tree = makeTree(makeParagraph(makeImage({ src: first })), makeParagraph(makeImage({ src: second })));

  await run(tree, { [first]: entry(first, { width: 100 }), [second]: entry(second, { width: 200 }) });

  const images = collect(tree, 'img');
  assert.equal(images.length, 2);
  assert.equal(images[0].properties?.width, 100);
  assert.equal(images[1].properties?.width, 200);
});

// --------- Real manifest accessor (end-to-end guard) ---------
//
// Everything above injects a fake lookup, so none of it can catch the accessor
// failing to load `src/assets/image-manifest.json` — a failure that used to be
// swallowed and silently disabled every placeholder in `pnpm build`.

test('the real accessor loads the generated manifest', async () => {
  const { getImageEntry, getImageManifest } = await import('../../lib/image-manifest-accessor');

  const manifest = getImageManifest();
  assert.ok(manifest, 'src/assets/image-manifest.json should load — run `pnpm generate:images`');

  const keys = Object.keys(manifest.images);
  assert.ok(keys.length > 0, 'manifest should contain at least one image');
  assert.ok(getImageEntry(keys[0]), `getImageEntry should resolve ${keys[0]}`);
});

test('enriches images using the real manifest accessor', async () => {
  const { getImageManifest } = await import('../../lib/image-manifest-accessor');
  const { lqipToGradient } = await import('../../scripts/lib/lqip-color');

  const manifest = getImageManifest();
  assert.ok(manifest, 'manifest is required for this test');

  const src = Object.keys(manifest.images)[0];
  const stored = manifest.images[src];
  const gradient = `background-image:${lqipToGradient(stored.lqip)}`;

  const tree = makeTree(makeParagraph(makeImage({ src, alt: 'Real image' })));
  // No injected lookup: this is the path `pnpm build` takes.
  await rehypeImagePlaceholder()(tree as never, { path: 'src/content/blog/post/example.md' });

  const img = findFirst(tree, 'img');
  assert.equal(img?.properties?.width, stored.width);
  assert.equal(img?.properties?.height, stored.height);
  assert.equal(img?.properties?.style, gradient);

  const ratio = Number((stored.width / stored.height).toFixed(6));
  assert.equal(findFirst(tree, 'figure')?.properties?.style, `${gradient};--img-ratio:${ratio}`);
});
