/**
 * LQIP color helpers shared by the generator and the runtime reader.
 *
 * The compact on-disk format is an 18-character lowercase hex string holding
 * three colors: top-left, top-right, and bottom-right of the source image.
 * They are rendered as a 135deg gradient at 0% / 50% / 100%.
 *
 * Example: "e1a0a3d58e96d5a1a9" → #e1a0a3, #d58e96, #d5a1a9
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** 18 hex chars = 3 colors × 6 chars. */
const LQIP_RE = /^[0-9a-f]{18}$/;

/** Convert an RGB triple to a `#rrggbb` string. */
function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/** Encode three colors into the compact manifest string. */
export function formatLqip(colors: readonly RgbColor[]): string {
  return colors
    .slice(0, 3)
    .map((color) => rgbToHex(color).slice(1))
    .join('');
}

/** Decode the compact manifest string into three `#rrggbb` colors, or null when invalid. */
export function parseLqip(compact: string | undefined | null): [string, string, string] | null {
  if (typeof compact !== 'string' || !LQIP_RE.test(compact)) return null;
  return [`#${compact.slice(0, 6)}`, `#${compact.slice(6, 12)}`, `#${compact.slice(12, 18)}`];
}

/** Build the CSS gradient used as an image placeholder background. */
export function lqipToGradient(compact: string | undefined | null): string | undefined {
  const colors = parseLqip(compact);
  if (!colors) return undefined;
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
}
