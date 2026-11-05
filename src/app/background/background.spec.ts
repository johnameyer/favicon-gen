import { validateSvgMarkup } from '../svg-upload/svg-upload';
import { DEFAULT_LETTER_OPTIONS } from '../letter/letter-svg';
import { hexToHsl } from '../recolor/color-utils';
import { IDENTITY_TRANSFORM, Layer } from '../models/layer';
import {
  DEFAULT_BACKGROUND,
  DEFAULT_CONTENT_SCALE,
  buildBackgroundSvg,
  withBackground,
} from './background';

const content: Layer[] = [
  {
    id: 'content',
    svgMarkup: '<svg/>',
    transform: { ...IDENTITY_TRANSFORM, x: 10, y: -20 },
    colorOverrides: { '#000000': '#FFFFFF' },
  },
];

describe('buildBackgroundSvg', () => {
  it('builds a valid SVG for each shape in the chosen color', () => {
    const circle = buildBackgroundSvg({
      shape: 'circle',
      color: '#123456',
      contentScale: DEFAULT_CONTENT_SCALE,
    });
    const square = buildBackgroundSvg({
      shape: 'rounded-square',
      color: '#123456',
      contentScale: DEFAULT_CONTENT_SCALE,
    });
    for (const svg of [circle, square]) {
      expect(validateSvgMarkup(svg).ok).toBe(true);
      expect(svg).toContain('fill="#123456"');
    }
    expect(circle).toContain('<circle');
    expect(square).toContain('<rect');
  });
});

describe('DEFAULT_BACKGROUND', () => {
  it("contrasts with the letter generator's default color, so a default letter stays visible on a shape", () => {
    const background = hexToHsl(DEFAULT_BACKGROUND.color);
    const letter = hexToHsl(DEFAULT_LETTER_OPTIONS.color);
    expect(DEFAULT_BACKGROUND.color).not.toBe(DEFAULT_LETTER_OPTIONS.color);
    expect(Math.abs(background.l - letter.l)).toBeGreaterThan(30);
  });
});

describe('withBackground', () => {
  it('returns the content unchanged with no background', () => {
    expect(
      withBackground(content, {
        shape: 'none',
        color: '#123456',
        contentScale: DEFAULT_CONTENT_SCALE,
      }),
    ).toBe(content);
  });

  it('adds the shape underneath and shrinks the content to fit inside it', () => {
    const layers = withBackground(content, {
      shape: 'circle',
      color: '#123456',
      contentScale: DEFAULT_CONTENT_SCALE,
    });
    expect(layers.map((layer) => layer.id)).toEqual(['background', 'content']);
    expect(layers[1].transform).toEqual({
      x: 10 * DEFAULT_CONTENT_SCALE,
      y: -20 * DEFAULT_CONTENT_SCALE,
      scale: DEFAULT_CONTENT_SCALE,
      rotation: 0,
    });
    expect(layers[1].colorOverrides).toEqual(content[0].colorOverrides);
  });

  it('scales the content by the chosen size', () => {
    const layers = withBackground(content, {
      shape: 'circle',
      color: '#123456',
      contentScale: 0.9,
    });
    expect(layers[1].transform.scale).toBe(0.9);
    expect(layers[1].transform.x).toBeCloseTo(9);
  });

  it('does not mutate the content layers', () => {
    withBackground(content, {
      shape: 'rounded-square',
      color: '#123456',
      contentScale: DEFAULT_CONTENT_SCALE,
    });
    expect(content[0].transform.scale).toBe(1);
  });

  it('keeps full-bleed content corners inside a circle by default', () => {
    expect(DEFAULT_CONTENT_SCALE * Math.SQRT2).toBeLessThanOrEqual(1);
  });
});
