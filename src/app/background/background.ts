import { IDENTITY_TRANSFORM, Layer } from '../models/layer';

/** Optional shape drawn behind the content, shared by every source mode. */
export type BackgroundShape = 'none' | 'circle' | 'rounded-square';

/** How the shape is filled: one color, or a gradient from `color` to `color2`. */
export type BackgroundFill = 'solid' | 'linear' | 'radial';

export interface BackgroundOptions {
  shape: BackgroundShape;
  /** Shape fill, as `#RRGGBB`; a gradient's start color. Ignored when `shape` is `'none'`. */
  color: string;
  fill: BackgroundFill;
  /** A gradient's end color (the edge, for radial), as `#RRGGBB`. */
  color2: string;
  /**
   * A linear gradient's direction in degrees, as in CSS `linear-gradient`:
   * 0 runs bottom-to-top, 90 left-to-right, 135 top-left to bottom-right.
   */
  angle: number;
  /** The rounded square's corner radius, as a percentage of its size (0-50; 50 is a circle). */
  cornerRadius: number;
  /**
   * Content size relative to the shape (1 = full size), so the content
   * doesn't have to touch the shape's edge. Ignored when `shape` is `'none'`.
   */
  contentScale: number;
}

/**
 * Default content scale over a shape. 0.68 also keeps a full-bleed square's
 * corners inside a circle (its diagonal is 0.68·√2 ≈ 0.96 of the diameter).
 */
export const DEFAULT_CONTENT_SCALE = 0.68;

/** Transparent by default, matching the app's transparent-favicon premise. */
export const DEFAULT_BACKGROUND: BackgroundOptions = {
  shape: 'none',
  color: '#3367D6',
  fill: 'solid',
  // Blue to a lighter sky blue: a subtle gradient that keeps white content readable.
  color2: '#5BC0EB',
  angle: 135,
  cornerRadius: 20,
  contentScale: DEFAULT_CONTENT_SCALE,
};

export const BACKGROUND_LAYER_ID = 'background';

const GRADIENT_ID = 'background-fill';

/** A `<defs>` gradient for a gradient fill, or nothing for a solid one. */
function gradientDefs(options: BackgroundOptions): string {
  const stops =
    `<stop offset="0" stop-color="${options.color}"/>` +
    `<stop offset="1" stop-color="${options.color2}"/>`;
  switch (options.fill) {
    case 'linear':
      // Left-to-right (CSS 90°) across the shape's box, rotated about its center.
      return (
        `<defs><linearGradient id="${GRADIENT_ID}" x1="0" y1="0.5" x2="1" y2="0.5"` +
        ` gradientTransform="rotate(${options.angle - 90} 0.5 0.5)">${stops}</linearGradient></defs>`
      );
    case 'radial':
      return `<defs><radialGradient id="${GRADIENT_ID}">${stops}</radialGradient></defs>`;
    case 'solid':
      return '';
  }
}

export function buildBackgroundSvg(options: BackgroundOptions): string {
  const fill = options.fill === 'solid' ? options.color : `url(#${GRADIENT_ID})`;
  const shape =
    options.shape === 'circle'
      ? `<circle cx="50" cy="50" r="50" fill="${fill}"/>`
      : `<rect width="100" height="100" rx="${options.cornerRadius}" fill="${fill}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `${gradientDefs(options)}${shape}</svg>`
  );
}

/**
 * Returns the layer stack to render/export: `contentLayers` unchanged when
 * there's no background, or a background-shape layer underneath them with
 * the content scaled by `options.contentScale`. The content
 * layers themselves aren't mutated, so recoloring keeps working on them.
 */
export function withBackground(contentLayers: Layer[], options: BackgroundOptions): Layer[] {
  if (options.shape === 'none') {
    return contentLayers;
  }
  const background: Layer = {
    id: BACKGROUND_LAYER_ID,
    svgMarkup: buildBackgroundSvg(options),
    transform: { ...IDENTITY_TRANSFORM },
  };
  const scaledContent = contentLayers.map((layer) => ({
    ...layer,
    transform: {
      ...layer.transform,
      x: layer.transform.x * options.contentScale,
      y: layer.transform.y * options.contentScale,
      scale: layer.transform.scale * options.contentScale,
    },
  }));
  return [background, ...scaledContent];
}
