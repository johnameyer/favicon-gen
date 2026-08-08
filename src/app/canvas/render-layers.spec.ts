import { effectiveSvgMarkup, renderLayersToCanvas } from './render-layers';
import { buildPlaceholderLayers } from './canvas-preview';
import { IDENTITY_TRANSFORM, Layer } from '../models/layer';

describe('effectiveSvgMarkup', () => {
  const svg = `<svg><path fill="#FF0000" /></svg>`;

  it('returns the raw markup unchanged when there are no color overrides', () => {
    const layer: Layer = { id: 'a', svgMarkup: svg, transform: { ...IDENTITY_TRANSFORM } };
    expect(effectiveSvgMarkup(layer)).toBe(svg);
  });

  it('returns the raw markup unchanged when colorOverrides is an empty object', () => {
    const layer: Layer = { id: 'a', svgMarkup: svg, transform: { ...IDENTITY_TRANSFORM }, colorOverrides: {} };
    expect(effectiveSvgMarkup(layer)).toBe(svg);
  });

  it('applies colorOverrides to the markup when present', () => {
    const layer: Layer = {
      id: 'a',
      svgMarkup: svg,
      transform: { ...IDENTITY_TRANSFORM },
      colorOverrides: { '#FF0000': '#00FF00' },
    };
    expect(effectiveSvgMarkup(layer)).toBe(`<svg><path fill="#00FF00" /></svg>`);
  });
});

describe('renderLayersToCanvas', () => {
  it('creates an off-screen canvas sized to the requested dimension', async () => {
    // jsdom does not implement CanvasRenderingContext2D (getContext returns
    // null), so this only exercises the canvas-creation/sizing contract, not
    // actual pixel drawing — see canvas-preview.spec.ts for the same pattern.
    // Real drawing is covered by the Playwright e2e suite in a real browser.
    const canvas = await renderLayersToCanvas(buildPlaceholderLayers('<svg></svg>'), 32);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
  });

  it('resolves for an empty layer stack', async () => {
    const canvas = await renderLayersToCanvas([], 16);
    expect(canvas.width).toBe(16);
    expect(canvas.height).toBe(16);
  });
});
