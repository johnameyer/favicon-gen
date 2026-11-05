import { validateSvgMarkup } from '../svg-upload/svg-upload';
import { extractColorGroups } from '../recolor/color-utils';
import {
  CustomFont,
  DEFAULT_LETTER_OPTIONS,
  buildLetterSvg,
  buildMeasureSvg,
  firstGrapheme,
} from './letter-svg';

const textElement = (svg: string) =>
  new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('text')!;

describe('firstGrapheme', () => {
  it('returns the first character', () => {
    expect(firstGrapheme('Hello')).toBe('H');
  });

  it('keeps multi-code-unit characters whole', () => {
    expect(firstGrapheme('é!')).toBe('é');
    expect(firstGrapheme('👍🏽x')).toBe('👍🏽');
  });

  it('returns an empty string for empty input', () => {
    expect(firstGrapheme('')).toBe('');
  });
});

describe('buildLetterSvg', () => {
  it('produces valid SVG containing only the first letter', () => {
    const svg = buildLetterSvg({ ...DEFAULT_LETTER_OPTIONS, letter: 'Zed' });
    expect(validateSvgMarkup(svg).ok).toBe(true);
    const text = new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('text');
    expect(text?.textContent).toBe('Z');
  });

  it('escapes XML-special characters', () => {
    for (const letter of ['<', '&', '>', '"']) {
      const svg = buildLetterSvg({ ...DEFAULT_LETTER_OPTIONS, letter });
      expect(validateSvgMarkup(svg).ok).toBe(true);
      const text = new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('text');
      expect(text?.textContent).toBe(letter);
    }
  });

  it('applies font, weight and color', () => {
    const svg = buildLetterSvg({
      ...DEFAULT_LETTER_OPTIONS,
      font: 'serif',
      weight: 300,
      color: '#112233',
    });
    expect(svg).toContain('font-family="serif"');
    expect(svg).toContain('font-weight="300"');
    expect(svg).toContain('fill="#112233"');
    expect(svg).not.toContain('font-style');
  });

  it('sets italic', () => {
    const svg = buildLetterSvg({ ...DEFAULT_LETTER_OPTIONS, italic: true });
    expect(textElement(svg).getAttribute('font-style')).toBe('italic');
  });

  it('is transparent apart from the letter, exposing only its color to the recolor panel', () => {
    const svg = buildLetterSvg({ ...DEFAULT_LETTER_OPTIONS, color: '#3367D6' });
    expect(svg).not.toMatch(/<rect|<circle/);
    expect(extractColorGroups(svg).flatColors).toEqual(['#3367D6']);
  });

  it('embeds a custom font when one is loaded, and falls back to sans-serif otherwise', () => {
    const custom = { ...DEFAULT_LETTER_OPTIONS, font: 'custom' as const };
    const embedded = buildLetterSvg(custom, { normal: 'data:font/woff2;base64,AAAA', axes: [] });
    expect(validateSvgMarkup(embedded).ok).toBe(true);
    expect(embedded).toContain('src:url(data:font/woff2;base64,AAAA)');
    expect(embedded).toContain('font-family="LetterCustomFont, sans-serif"');

    const notLoaded = buildLetterSvg(custom);
    expect(notLoaded).not.toContain('@font-face');
    expect(notLoaded).toContain('font-family="sans-serif"');
  });

  describe('custom font styles and axes', () => {
    const font: CustomFont = {
      normal: 'data:font/woff2;base64,NORMAL',
      italic: 'data:font/woff2;base64,ITALIC',
      axes: [
        { tag: 'opsz', min: 8, default: 14, max: 144, hidden: false },
        { tag: 'wght', min: 100, default: 400, max: 1000, hidden: false },
      ],
    };
    const custom = { ...DEFAULT_LETTER_OPTIONS, font: 'custom' as const };

    it("embeds the stylesheet's italic file, declared italic so it isn't slanted twice", () => {
      const svg = buildLetterSvg({ ...custom, italic: true }, font);
      expect(svg).toContain('font-style:italic;src:url(data:font/woff2;base64,ITALIC)');
      expect(svg).not.toContain('NORMAL');
      expect(textElement(svg).getAttribute('font-style')).toBe('italic');
    });

    it('synthesizes italics from the normal file when there is no italic one', () => {
      const svg = buildLetterSvg({ ...custom, italic: true }, { ...font, italic: undefined });
      expect(svg).toContain('font-style:normal;src:url(data:font/woff2;base64,NORMAL)');
      expect(textElement(svg).getAttribute('font-style')).toBe('italic');
    });

    it('sets every axis, using chosen values or the defaults, and weight only through wght', () => {
      const svg = buildLetterSvg({ ...custom, weight: 700, axes: { wght: 850 } }, font);
      expect(textElement(svg).getAttribute('style')).toBe(
        "font-variation-settings: 'opsz' 14, 'wght' 850",
      );
      // font-weight on top of the wght axis would synthesize extra boldness.
      expect(textElement(svg).hasAttribute('font-weight')).toBe(false);
    });

    it('uses font-weight for a custom font without a wght axis', () => {
      const svg = buildLetterSvg({ ...custom, weight: 700 }, { normal: font.normal, axes: [] });
      expect(textElement(svg).getAttribute('font-weight')).toBe('700');
      expect(textElement(svg).hasAttribute('style')).toBe(false);
    });

    it('measures with exactly the same font styling it renders with', () => {
      const options = { ...custom, italic: true, axes: { wght: 850, opsz: 40 } };
      const rendered = textElement(buildLetterSvg(options, font));
      const measured = textElement(buildMeasureSvg(options, font));
      for (const name of ['font-family', 'font-weight', 'font-style', 'style']) {
        expect(measured.getAttribute(name)).toBe(rendered.getAttribute(name));
      }
      expect(buildMeasureSvg(options, font)).toContain('ITALIC');
    });
  });

  describe('with measured glyph bounds', () => {
    const textAttributes = (svg: string) => {
      const text = new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('text')!;
      return {
        x: Number(text.getAttribute('x')),
        y: Number(text.getAttribute('y')),
        fontSize: Number(text.getAttribute('font-size')),
        anchored: text.hasAttribute('text-anchor') || text.hasAttribute('dominant-baseline'),
      };
    };

    it('centers the ink box and scales its larger side to the padded extent', () => {
      // A glyph 0.5em wide and 0.8em tall, sitting 0.1em right of its origin with a 0.2em descender.
      const glyph = { left: -0.1, right: 0.6, ascent: 0.6, descent: 0.2 };
      const { x, y, fontSize, anchored } = textAttributes(
        buildLetterSvg(DEFAULT_LETTER_OPTIONS, undefined, glyph),
      );
      expect(anchored).toBe(false);
      expect(fontSize).toBeCloseTo(92 / 0.8, 1);
      // Ink spans [x - left*fs, x + right*fs] horizontally and [y - ascent*fs, y + descent*fs] vertically.
      expect((x + glyph.left * -fontSize + x + glyph.right * fontSize) / 2).toBeCloseTo(50, 1);
      expect((y - glyph.ascent * fontSize + y + glyph.descent * fontSize) / 2).toBeCloseTo(50, 1);
    });
  });
});
