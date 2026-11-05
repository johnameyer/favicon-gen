import { IDENTITY_TRANSFORM, Layer } from '../models/layer';

/** Optional shape drawn behind the content, shared by every source mode. */
export type BackgroundShape = 'none' | 'circle' | 'rounded-square';

export interface BackgroundOptions {
  shape: BackgroundShape;
  /** Shape fill, as `#RRGGBB`. Ignored when `shape` is `'none'`. */
  color: string;
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
  contentScale: DEFAULT_CONTENT_SCALE,
};

export const BACKGROUND_LAYER_ID = 'background';

export function buildBackgroundSvg(options: BackgroundOptions): string {
  const shape =
    options.shape === 'circle'
      ? `<circle cx="50" cy="50" r="50" fill="${options.color}"/>`
      : `<rect width="100" height="100" rx="20" fill="${options.color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${shape}</svg>`;
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
