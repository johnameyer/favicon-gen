import { svgToDataUrl } from '../canvas/svg-data-url';
import { GlyphBox, MEASURE_LAYOUT } from './letter-svg';

/** Canvas pixels per viewBox unit when rasterizing for measurement; 2 gives ~0.005em precision. */
const MEASURE_SCALE = 2;

/**
 * Measures a glyph's ink bounds by rasterizing `measureSvg` (from
 * `buildMeasureSvg`) and scanning for painted pixels, so the letter can be
 * centered on its actual shape.
 *
 * Reading pixels, rather than canvas `measureText`, is what makes this
 * exact for everything the SVG can express: embedded custom fonts, italics
 * (real or synthesized) and arbitrary variation axes, none of which
 * `measureText` can apply. It's the same engine and markup that render the
 * favicon, so the bounds match what ends up drawn.
 *
 * Resolves `undefined` where canvas rendering isn't available (e.g. jsdom),
 * or for glyphs with no ink (e.g. a space); callers fall back to
 * metric-based centering.
 */
export async function measureGlyph(measureSvg: string): Promise<GlyphBox | undefined> {
  const pixels = MEASURE_LAYOUT.size * MEASURE_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext?.('2d', { willReadFrequently: true });
  if (!ctx) {
    return undefined;
  }

  const image = new Image();
  image.src = svgToDataUrl(measureSvg);
  try {
    await image.decode();
  } catch {
    return undefined;
  }
  ctx.drawImage(image, 0, 0, pixels, pixels);
  const { data } = ctx.getImageData(0, 0, pixels, pixels);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < pixels; y++) {
    for (let x = 0; x < pixels; x++) {
      if (data[(y * pixels + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (minX > maxX) {
    return undefined;
  }

  // Convert pixel edges back to em units relative to the text origin.
  const { originX, originY, fontSize } = MEASURE_LAYOUT;
  const toUnits = (pixel: number) => pixel / MEASURE_SCALE;
  return {
    left: (originX - toUnits(minX)) / fontSize,
    right: (toUnits(maxX + 1) - originX) / fontSize,
    ascent: (originY - toUnits(minY)) / fontSize,
    descent: (toUnits(maxY + 1) - originY) / fontSize,
  };
}

/**
 * Rejects if the browser can't parse `dataUrl` as a font (e.g. the URL
 * served an HTML page), so that's reported instead of silently falling back
 * to sans-serif. No-op where the CSS Font Loading API isn't available.
 */
export async function assertLoadableFont(dataUrl: string): Promise<void> {
  if (typeof FontFace === 'undefined') {
    return;
  }
  try {
    await new FontFace('LetterFontCheck', `url(${dataUrl})`).load();
  } catch {
    throw new Error("That file isn't a font the browser can read.");
  }
}
