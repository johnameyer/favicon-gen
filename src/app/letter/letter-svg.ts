/**
 * Pure, framework-free SVG generation for single-letter favicons. Output is
 * plain SVG markup, so it flows through the same layer/recolor/export path
 * as emoji and uploaded SVGs.
 */

import { FontAxis } from './font-axes';

/**
 * Generic font families, or `'custom'` for a user-supplied font. The SVG is
 * rendered via an `<img>` data URL, which can't load web fonts by URL, so a
 * custom font has to be embedded (see `font-loader.ts`).
 */
export type LetterFont = 'sans-serif' | 'serif' | 'monospace' | 'custom';

export interface LetterOptions {
  letter: string;
  font: LetterFont;
  /**
   * CSS font weight (100-900) for fonts without a `wght` axis. A variable
   * font's weight is set through `axes.wght` instead (see `buildLetterSvg`).
   */
  weight: number;
  italic: boolean;
  /** Letter fill, as `#RRGGBB`. */
  color: string;
  /** Font file or stylesheet URL, used when `font` is `'custom'`. */
  customFontUrl: string;
  /** Chosen value per variation axis tag of the loaded custom font, e.g. `{ wdth: 75 }`. */
  axes: Record<string, number>;
}

export const DEFAULT_LETTER_OPTIONS: LetterOptions = {
  letter: 'A',
  font: 'sans-serif',
  weight: 700,
  italic: false,
  // White on the default background blue (#3367D6) is 5.2:1 contrast.
  color: '#FFFFFF',
  customFontUrl: '',
  axes: {},
};

/** A loaded custom font, as embedded `data:` URLs plus its variation axes. */
export interface CustomFont {
  normal: string;
  /** A dedicated italic file, when the stylesheet provides one. Otherwise italics are synthesized. */
  italic?: string;
  axes: FontAxis[];
}

/** Internal family name for an embedded custom font; fixed so user input never needs escaping. */
export const CUSTOM_FONT_FAMILY = 'LetterCustomFont';

/**
 * A glyph's ink bounds relative to its text origin (left/alphabetic
 * baseline), in em units. See `measureGlyph`.
 */
export interface GlyphBox {
  left: number;
  right: number;
  ascent: number;
  descent: number;
}

/**
 * Returns the first user-perceived character (grapheme) of `text`, so that
 * multi-code-unit input like accented letters or emoji isn't cut in half.
 */
export function firstGrapheme(text: string): string {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);
  for (const { segment } of segments) {
    return segment;
  }
  return '';
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Largest extent (in viewBox units) the letter's ink may take up. The
 * letter is always generated full-bleed; padding inside a background shape
 * comes from the shared background scaling the whole layer (see
 * `withBackground`).
 */
const MAX_GLYPH_EXTENT = 92;

/**
 * Text placement attributes. With a measured `glyph`, the letter's actual
 * ink is centered and scaled to fill `MAX_GLYPH_EXTENT`; without one (no
 * canvas available), it falls back to centering on font-wide metrics.
 */
function textLayoutAttributes(glyph?: GlyphBox): string {
  if (!glyph) {
    return `x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="90"`;
  }
  const fontSize =
    MAX_GLYPH_EXTENT / Math.max(glyph.left + glyph.right, glyph.ascent + glyph.descent);
  const x = 50 - ((glyph.right - glyph.left) / 2) * fontSize;
  const y = 50 + ((glyph.ascent - glyph.descent) / 2) * fontSize;
  const round = (value: number) => Math.round(value * 100) / 100;
  return `x="${round(x)}" y="${round(y)}" font-size="${round(fontSize)}"`;
}

/**
 * The `<style>` block and font attributes for the letter, shared by the
 * real SVG and the one `measureGlyph` renders, so both draw the same glyph.
 */
function fontMarkup(
  options: LetterOptions,
  customFont?: CustomFont,
): { style: string; attributes: string } {
  const custom = options.font === 'custom' ? customFont : undefined;
  const italic = options.italic ? ' font-style="italic"' : '';
  if (!custom) {
    const family = options.font === 'custom' ? 'sans-serif' : options.font;
    return {
      style: '',
      attributes: `font-family="${family}" font-weight="${options.weight}"${italic}`,
    };
  }

  // Embed only the face in use. A dedicated italic file is declared as
  // such, so the browser uses it as-is instead of slanting it again.
  const useItalicFile = options.italic && !!custom.italic;
  const style =
    `<style>@font-face{font-family:${CUSTOM_FONT_FAMILY};` +
    `font-style:${useItalicFile ? 'italic' : 'normal'};` +
    `src:url(${useItalicFile ? custom.italic : custom.normal})}</style>`;

  // A variable font's weight goes through its wght axis. Also setting
  // font-weight would make the browser synthesize bold on top of it.
  const hasWeightAxis = custom.axes.some((axis) => axis.tag === 'wght');
  const weight = hasWeightAxis ? '' : ` font-weight="${options.weight}"`;
  const settings = custom.axes
    .map((axis) => `'${axis.tag}' ${options.axes[axis.tag] ?? axis.default}`)
    .join(', ');
  const variation = settings ? ` style="font-variation-settings: ${settings}"` : '';
  return {
    style,
    attributes: `font-family="${CUSTOM_FONT_FAMILY}, sans-serif"${weight}${italic}${variation}`,
  };
}

/**
 * Builds a square, transparent SVG with `options.letter` (first grapheme
 * only) centered and filling it. Pass the letter's measured `glyph` bounds
 * (see `measureGlyph`) to center it on its actual shape; otherwise
 * font-wide metrics are used, which leave descenders, italics and some
 * fonts off-center.
 *
 * When `options.font` is `'custom'`, `customFont` is embedded as an
 * `@font-face`; until it's loaded the letter falls back to sans-serif.
 */
export function buildLetterSvg(
  options: LetterOptions,
  customFont?: CustomFont,
  glyph?: GlyphBox,
): string {
  const { style, attributes } = fontMarkup(options, customFont);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${style}` +
    `<text ${textLayoutAttributes(glyph)} ${attributes} fill="${options.color}">` +
    `${escapeXml(firstGrapheme(options.letter))}</text></svg>`
  );
}

/** Where `buildMeasureSvg` puts the text origin and how big it draws it, in viewBox units. */
export const MEASURE_LAYOUT = { size: 400, originX: 100, originY: 250, fontSize: 100 };

/**
 * An SVG drawing the letter exactly as `buildLetterSvg` would style it, at a
 * known origin and size with plenty of room around it, so its ink bounds
 * can be read off the rendered pixels (see `measureGlyph`).
 */
export function buildMeasureSvg(options: LetterOptions, customFont?: CustomFont): string {
  const { style, attributes } = fontMarkup(options, customFont);
  const { size, originX, originY, fontSize } = MEASURE_LAYOUT;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${style}` +
    `<text x="${originX}" y="${originY}" font-size="${fontSize}" ${attributes} fill="#000">` +
    `${escapeXml(firstGrapheme(options.letter))}</text></svg>`
  );
}
