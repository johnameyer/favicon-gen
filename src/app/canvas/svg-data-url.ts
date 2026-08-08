/**
 * Encodes SVG markup as a base64 `data:image/svg+xml` URL suitable for use
 * as an `HTMLImageElement` source, which can then be drawn onto a canvas.
 */
export function svgToDataUrl(svgMarkup: string): string {
  const base64 = btoa(unescape(encodeURIComponent(svgMarkup)));
  return `data:image/svg+xml;base64,${base64}`;
}
