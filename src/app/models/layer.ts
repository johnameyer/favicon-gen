/**
 * A single visual element in the canvas's layer stack.
 *
 * The canvas is modeled as a stack of layers rendered in order (bottom to
 * top), even though today there is always exactly one static layer. This
 * keeps the data model honest so that future work (multi-emoji compositing,
 * per-layer recoloring, reordering) is additive rather than a rewrite.
 */
export interface Layer {
  /** Stable identifier for the layer, used for tracking/reordering. */
  id: string;
  /** Raw SVG markup for this layer's content. */
  svgMarkup: string;
  /** Placement of this layer within the canvas's coordinate space. */
  transform: LayerTransform;
}

/** Position, scale and rotation of a layer within the canvas. */
export interface LayerTransform {
  /** Horizontal offset in canvas pixels. */
  x: number;
  /** Vertical offset in canvas pixels. */
  y: number;
  /** Uniform scale factor, 1 = natural size. */
  scale: number;
  /** Rotation in degrees, clockwise. */
  rotation: number;
}

/** A transform representing "no adjustment" - centered, natural size, unrotated. */
export const IDENTITY_TRANSFORM: LayerTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};
