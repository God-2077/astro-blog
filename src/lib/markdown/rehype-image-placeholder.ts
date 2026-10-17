/**
 * Rehype plugin to enhance images with lazy loading and placeholder containers
 *
 * Wraps images in figure elements with placeholder styling for CLS prevention,
 * and enriches them with metadata from `src/assets/image-manifest.json`:
 *
 * - a LQIP gradient background (visible while the image is still loading), and
 * - intrinsic `width`/`height` so the browser reserves the correct aspect ratio.
 *
 * Images without a manifest entry keep exactly the previous behaviour.
 */
import path from 'node:path';
import type { Element, Root, Text } from 'hast';
import { SKIP, visit } from 'unist-util-visit';
import type { ImageManifestEntry } from '../../scripts/lib/image-manifest';
import { getImageEntry } from '../image-manifest-accessor';

export interface ImagePlaceholderOptions {
  /**
   * Manifest accessor used to enrich images. Defaults to the cached
   * `src/assets/image-manifest.json` reader; tests inject a fixed snapshot.
   */
  readManifest?: (src: string) => ImageManifestEntry | null;
  /** Disable manifest enrichment entirely (keeps the previous behaviour). */
  useManifest?: boolean;
}

/** Whether the src is an absolute URL or a site-absolute path. */
function isDirectRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref) || ref.startsWith('/');
}

/**
 * Rewrite a filesystem path as a project-root-relative path.
 *
 * `vfile.path` is usually absolute (e.g.
 * `C:\proj\src\content\blog\post\foo.md`), so the project root is stripped to
 * produce `src/content/blog/post/foo.md`. Paths that are already relative — as
 * used by the unit tests — are returned unchanged.
 */
function toProjectRelative(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (!path.posix.isAbsolute(normalized) && !/^[A-Za-z]:\//.test(normalized)) return normalized;

  const cwd = process.cwd().replace(/\\/g, '/').replace(/\/+$/, '');
  if (cwd && normalized.startsWith(`${cwd}/`)) return normalized.slice(cwd.length + 1);

  // Fall back to matching the workspace tail, tolerating drive-case differences.
  const tail = cwd.replace(/^[A-Za-z]:/, '');
  const index = tail ? normalized.indexOf(`${tail}/`) : -1;
  return index === -1 ? normalized.replace(/^\/+/, '') : normalized.slice(index + tail.length + 1);
}

/** Collapse `.` / `..` segments without resolving against the process CWD. */
function collapseSegments(parts: readonly string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out;
}

/**
 * Resolve a bare relative src against the markdown file being processed.
 *
 * Returns a project-root-relative site path such as
 * `src/content/blog/post/bar.webp`, never an absolute filesystem path.
 */
function resolveRelativeRef(src: string, vfilePath: string | undefined): string | null {
  if (!vfilePath) return null;

  try {
    const relative = toProjectRelative(vfilePath);
    const dir = path.posix.dirname(relative);
    const segments = collapseSegments(`${dir}/${src}`.replace(/\\/g, '/').split('/'));
    return segments.length ? segments.join('/') : null;
  } catch {
    return null;
  }
}

/** Whether the author already declared both dimensions. */
function hasExplicitDimensions(node: Element): boolean {
  return node.properties?.width !== undefined && node.properties?.height !== undefined;
}

/** Parse a positive, finite pixel dimension, or return null. */
function toPositiveNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Compute a CSS-friendly width / height ratio.
 *
 * The wrapper needs this before the image loads: without it, a percentage
 * width inside the reset's `figure { inline-size: fit-content }` has no
 * definite size to resolve against and the placeholder collapses.
 */
function aspectRatioOf(width: unknown, height: unknown): number | null {
  const w = toPositiveNumber(width);
  const h = toPositiveNumber(height);
  if (w === null || h === null) return null;
  return Number((w / h).toFixed(6));
}

/**
 * Build the placeholder gradient from the compact 3-color LQIP string.
 * Kept local so the plugin has no dependency on runtime styling helpers.
 */
function buildGradient(lqip: string | undefined): string | undefined {
  if (typeof lqip !== 'string' || !/^[0-9a-f]{18}$/.test(lqip)) return undefined;
  const c1 = `#${lqip.slice(0, 6)}`;
  const c2 = `#${lqip.slice(6, 12)}`;
  const c3 = `#${lqip.slice(12, 18)}`;
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
}

export function rehypeImagePlaceholder(options: ImagePlaceholderOptions = {}) {
  const lookup = options.readManifest ?? getImageEntry;
  const useManifest = options.useManifest !== false;

  return async (tree: Root, vfile?: { path?: string }) => {
    const enhancements = new Map<Element, { entry: ImageManifestEntry | null }>();

    // Pass 0: resolve manifest metadata for every image up front, so the
    // transform passes below can stay purely synchronous.
    const images: Element[] = [];
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') images.push(node);
    });

    for (const node of images) {
      const src = node.properties?.src;
      if (!useManifest || typeof src !== 'string' || !src) continue;

      const ref = isDirectRef(src) ? src : resolveRelativeRef(src, vfile?.path);
      const entry = ref ? lookup(ref) : null;
      if (entry) enhancements.set(node, { entry });
    }

    // Pass 1: enrich, then wrap in a figure container.
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'img') return;
      if (index === undefined || !parent) return;

      // Skip if already wrapped (e.g., in a figure or a custom component)
      if (parent.type === 'element' && parent.tagName === 'figure') return;

      const entry = enhancements.get(node)?.entry ?? null;
      const gradient = entry ? buildGradient(entry.lqip) : undefined;

      const dimensionProps: Record<string, number> = {};
      if (entry && !hasExplicitDimensions(node)) {
        dimensionProps.width = entry.width;
        dimensionProps.height = entry.height;
      }

      // Prefer author-specified dimensions: they also drive the img's intrinsic
      // ratio, so the wrapper must reserve the same ratio.
      const ratio = hasExplicitDimensions(node)
        ? aspectRatioOf(node.properties?.width, node.properties?.height)
        : aspectRatioOf(entry?.width, entry?.height);

      const styleProps: Record<string, string> = {};
      if (gradient) styleProps.style = `background-image:${gradient}`;

      // Images inside <a> links: apply lazy/async but skip figure wrapping —
      // wrapping would break the link and the image lacks a standalone caption context
      if (parent.type === 'element' && parent.tagName === 'a') {
        node.properties = {
          ...node.properties,
          loading: 'lazy',
          decoding: 'async',
          ...dimensionProps,
          ...styleProps,
        };
        return;
      }

      // Get existing class (handle both string and array formats per HAST spec)
      const existingClass = Array.isArray(node.properties?.class)
        ? node.properties.class.join(' ')
        : (node.properties?.class ?? '');

      // Add lazy loading attributes and class
      node.properties = {
        ...node.properties,
        loading: 'lazy',
        decoding: 'async',
        class: `${existingClass} markdown-image`.trim(),
        ...dimensionProps,
        ...styleProps,
      };

      const alt = typeof node.properties?.alt === 'string' ? node.properties.alt.trim() : '';
      const caption: Element | null = alt
        ? {
            type: 'element',
            tagName: 'figcaption',
            properties: { class: 'markdown-image-caption' },
            children: [{ type: 'text', value: alt }],
          }
        : null;

      // Wrap in figure container; mirror the gradient so the figure reserves a
      // matching background even before the image paints. `--img-ratio` lets
      // CSS reserve the final box size from the very first paint.
      const wrapperStyle = [gradient ? `background-image:${gradient}` : null, ratio !== null ? `--img-ratio:${ratio}` : null]
        .filter(Boolean)
        .join(';');

      const wrapper: Element = {
        type: 'element',
        tagName: 'figure',
        properties: {
          class: 'markdown-image-wrapper',
          ...(wrapperStyle ? { style: wrapperStyle } : {}),
        },
        children: caption ? [node, caption] : [node],
      };

      // Replace img with wrapper
      parent.children[index] = wrapper;
    });

    // Pass 2: unwrap <p> that only contains <figure> elements
    // Fixes invalid <p><figure> nesting that breaks portrait image grouping
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'p' || index === undefined || !parent) return;

      const meaningful = node.children.filter((c) => !(c.type === 'text' && (c as Text).value.trim() === ''));
      if (meaningful.length > 0 && meaningful.every((c) => c.type === 'element' && (c as Element).tagName === 'figure')) {
        parent.children.splice(index, 1, ...node.children);
        return [SKIP, index] as const;
      }
    });
  };
}
