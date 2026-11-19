/**
 * Zoom geometry for the image lightbox.
 *
 * The viewer shows an image scaled to fit the viewport and then applies CSS
 * transforms for zooming. Once the transform scale exceeds the image's native
 * resolution, the browser can only upscale the source pixels, which looks
 * blurry. This helper computes the largest scale that still maps one image
 * pixel to at least one device pixel.
 */

export const LIGHTBOX_MAX_SCALE = 5;

export interface NativeZoomInput {
  naturalWidth: number;
  naturalHeight: number;
  layoutWidth: number;
  layoutHeight: number;
  devicePixelRatio: number;
  maxScale?: number;
}

/**
 * Largest useful zoom scale for an image displayed at `layoutWidth` ×
 * `layoutHeight`. Returns `maxScale` when the geometry is not measurable yet,
 * and never goes below 1 (a small image cannot be zoomed without upscaling).
 */
export function computeNativeMaxZoom({
  naturalWidth,
  naturalHeight,
  layoutWidth,
  layoutHeight,
  devicePixelRatio,
  maxScale = LIGHTBOX_MAX_SCALE,
}: NativeZoomInput): number {
  if (
    !Number.isFinite(naturalWidth) ||
    naturalWidth <= 0 ||
    !Number.isFinite(naturalHeight) ||
    naturalHeight <= 0 ||
    !Number.isFinite(layoutWidth) ||
    layoutWidth <= 0 ||
    !Number.isFinite(layoutHeight) ||
    layoutHeight <= 0
  ) {
    return maxScale;
  }

  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const nativeScale = Math.min(naturalWidth / (layoutWidth * dpr), naturalHeight / (layoutHeight * dpr));

  return Math.min(maxScale, Math.max(1, nativeScale));
}
