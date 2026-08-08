import { Layer } from '../models/layer';
import { applyColorMap } from '../recolor/color-utils';
import { svgToDataUrl } from './svg-data-url';

/**
 * Returns the SVG markup that should actually be rendered/exported for a
 * layer: `layer.svgMarkup` with `layer.colorOverrides` applied, if any, or
 * the raw markup unchanged otherwise. Kept as a standalone pure helper (not
 * baked into `renderLayersToCanvas`) so callers other than the canvas
 * renderer can also honor overrides consistently.
 */
export function effectiveSvgMarkup(layer: Layer): string {
  if (!layer.colorOverrides || Object.keys(layer.colorOverrides).length === 0) {
    return layer.svgMarkup;
  }
  return applyColorMap(layer.svgMarkup, layer.colorOverrides);
}

/**
 * Renders a layer stack onto a freshly created off-screen canvas at the
 * given size, and returns that canvas. Framework-free so it can be shared
 * between the live preview and export paths (e.g. multi-resolution ICO
 * export), without depending on any Angular view/ElementRef.
 */
export async function renderLayersToCanvas(layers: Layer[], size: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  ctx.clearRect(0, 0, size, size);

  for (const layer of layers) {
    const image = await loadImage(svgToDataUrl(effectiveSvgMarkup(layer)));
    drawLayer(ctx, image, layer, size);
  }

  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load layer image: ${src.slice(0, 40)}...`));
    image.src = src;
  });
}

function drawLayer(ctx: CanvasRenderingContext2D, image: HTMLImageElement, layer: Layer, canvasSize: number): void {
  const { x, y, scale, rotation } = layer.transform;
  const size = canvasSize * scale;

  ctx.save();
  ctx.translate(canvasSize / 2 + x, canvasSize / 2 + y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}
