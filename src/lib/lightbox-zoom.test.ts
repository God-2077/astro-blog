/**
 * Unit tests for the lightbox native-resolution zoom limit.
 *
 * Run with: pnpm test:lightbox
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeNativeMaxZoom, LIGHTBOX_MAX_SCALE } from './lightbox-zoom';

test('caps the scale where one image pixel maps to one device pixel', () => {
  // 3840px source shown at 1330 CSS px on a 1.5x display.
  assert.equal(
    computeNativeMaxZoom({
      naturalWidth: 3840,
      naturalHeight: 2160,
      layoutWidth: 1330,
      layoutHeight: 748,
      devicePixelRatio: 1.5,
    }),
    3840 / (1330 * 1.5),
  );
});

test('never exceeds the viewer maximum', () => {
  assert.equal(
    computeNativeMaxZoom({
      naturalWidth: 8000,
      naturalHeight: 4500,
      layoutWidth: 1000,
      layoutHeight: 562,
      devicePixelRatio: 1,
    }),
    LIGHTBOX_MAX_SCALE,
  );
});

test('never drops below 1 for images smaller than their layout box', () => {
  assert.equal(
    computeNativeMaxZoom({
      naturalWidth: 320,
      naturalHeight: 180,
      layoutWidth: 320,
      layoutHeight: 180,
      devicePixelRatio: 2,
    }),
    1,
  );
});

test('uses the more restrictive axis', () => {
  assert.equal(
    computeNativeMaxZoom({
      naturalWidth: 4000,
      naturalHeight: 1000,
      layoutWidth: 1000,
      layoutHeight: 500,
      devicePixelRatio: 1,
    }),
    2,
  );
});

test('falls back to maxScale when dimensions are not ready', () => {
  assert.equal(
    computeNativeMaxZoom({
      naturalWidth: 0,
      naturalHeight: 0,
      layoutWidth: 0,
      layoutHeight: 0,
      devicePixelRatio: 1.5,
    }),
    LIGHTBOX_MAX_SCALE,
  );
});

test('tolerates a missing or invalid device pixel ratio', () => {
  assert.equal(
    computeNativeMaxZoom({
      naturalWidth: 2000,
      naturalHeight: 1000,
      layoutWidth: 1000,
      layoutHeight: 500,
      devicePixelRatio: Number.NaN,
    }),
    2,
  );
});
