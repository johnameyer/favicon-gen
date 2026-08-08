import { applyColorMap, extractColors, groupColorsByHue, hexToHsl, hslToHex, recolorGroup } from './color-utils';

/**
 * Representative snippets built from real Noto Emoji SVG markup
 * (emoji_u1f697.svg "sedan" / emoji_u1f699.svg "SUV" from
 * https://github.com/googlefonts/noto-emoji), reduced to one `<path
 * style="fill:#RRGGBB;">` per distinct color actually used in each source
 * SVG, in the same order those colors first appear in the real files. The
 * `d` attribute geometry is irrelevant to color extraction/grouping so it's
 * omitted here to keep the fixture readable.
 */
function sedanSvg(): string {
  const colors = ['#F92612', '#D70617', '#FFFEFF', '#D5CCC2', '#546D81', '#AFE3FB', '#AF0F21', '#4E433D', '#C8C8C8'];
  return `<svg xmlns="http://www.w3.org/2000/svg">${colors
    .map((c) => `<path style="fill:${c};" d="M0,0z"/>`)
    .join('')}</svg>`;
}

function suvSvg(): string {
  const colors = [
    '#31322E',
    '#489DF6',
    '#506D71',
    '#4C443F',
    '#C8C8C8',
    '#1D86FB',
    '#FF2A23',
    '#FFFFFF',
    '#D7CCC5',
    '#506D73',
    '#AFE3FB',
    '#0250AC',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg">${colors
    .map((c) => `<path style="fill:${c};" d="M0,0z"/>`)
    .join('')}</svg>`;
}

describe('extractColors', () => {
  it('extracts colors from inline style="fill:#RRGGBB;" (real Noto sedan colors)', () => {
    const colors = extractColors(sedanSvg());
    expect(colors).toEqual([
      '#F92612',
      '#D70617',
      '#FFFEFF',
      '#D5CCC2',
      '#546D81',
      '#AFE3FB',
      '#AF0F21',
      '#4E433D',
      '#C8C8C8',
    ]);
  });

  it('extracts colors from the real Noto SUV colors', () => {
    const colors = extractColors(suvSvg());
    expect(colors).toContain('#0250AC');
    expect(colors).toContain('#1D86FB');
    expect(colors).toContain('#506D71');
    expect(colors).toContain('#C8C8C8');
  });

  it('ignores non-color values and dedupes, preserving first-seen order', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <path fill="none" />
        <path fill="currentColor" />
        <path fill="transparent" />
        <path fill="#ABC" />
        <path style="fill:#aabbcc;stroke:#112233;" />
        <path fill="#ABC" />
      </svg>`;
    expect(extractColors(svg)).toEqual(['#AABBCC', '#112233']);
  });

  it('handles both attribute and style-property forms for fill and stroke', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <path fill="#FF0000" stroke="#00FF00" />
        <path style="fill: #0000FF; stroke: #FFFF00;" />
      </svg>`;
    expect(extractColors(svg)).toEqual(['#FF0000', '#00FF00', '#0000FF', '#FFFF00']);
  });
});

describe('hexToHsl / hslToHex round-tripping', () => {
  it.each(['#FF0000', '#00FF00', '#0000FF', '#123456', '#ABCDEF', '#000000', '#FFFFFF', '#808080', '#F92612'])(
    'round-trips %s',
    (hex) => {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    },
  );

  it('computes known HSL values', () => {
    expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHsl('#808080').s).toBe(0);
  });
});

describe('groupColorsByHue', () => {
  it('does not group sedan gray (#C8C8C8, achromatic) with the red family', () => {
    const colors = extractColors(sedanSvg());
    const groups = groupColorsByHue(colors);

    const grayGroup = groups.find((g) => g.colors.includes('#C8C8C8'));
    expect(grayGroup?.colors).toEqual(['#C8C8C8']);

    const redGroup = groups.find((g) => g.colors.includes('#F92612'));
    expect(redGroup?.colors).toEqual(expect.arrayContaining(['#F92612', '#D70617', '#AF0F21']));
    expect(redGroup?.colors).not.toContain('#C8C8C8');
  });

  it('keeps SUV blue-body and window-glass teal as separate groups', () => {
    const colors = extractColors(suvSvg());
    const groups = groupColorsByHue(colors);

    const blueGroup = groups.find((g) => g.colors.includes('#0250AC'));
    const tealGroup = groups.find((g) => g.colors.includes('#506D71'));

    expect(blueGroup).toBeDefined();
    expect(tealGroup).toBeDefined();
    expect(blueGroup!.id).not.toBe(tealGroup!.id);
    expect(blueGroup!.colors).toEqual(expect.arrayContaining(['#0250AC', '#1D86FB', '#489DF6']));
    expect(blueGroup!.colors).not.toContain('#506D71');
    expect(tealGroup!.colors).not.toContain('#0250AC');
  });

  it('gates hue-clustering by saturation threshold: low-saturation colors are never grouped', () => {
    const groups = groupColorsByHue(['#808080', '#FF0000'], { satThreshold: 15 });
    const grayGroup = groups.find((g) => g.colors.includes('#808080'));
    expect(grayGroup?.colors).toEqual(['#808080']);
  });

  it('groups colors within the hue distance threshold, wrapping around 0/360', () => {
    // hues near 0/360 boundary should still cluster together
    const groups = groupColorsByHue(['#FF0000', '#FF0505'], { hueDistance: 11, satThreshold: 15 });
    expect(groups.length).toBe(1);
    expect(groups[0].colors).toEqual(expect.arrayContaining(['#FF0000', '#FF0505']));
  });
});

describe('recolorGroup', () => {
  it('applies additive hue offset and ratio-preserving saturation/lightness', () => {
    // dominant #F92612 -> h=5.19, s=95.06, l=52.35
    // new color   #0000FF -> h=240, s=100, l=50
    // hueDelta = 240 - 5.19 = 234.81 -> wrapped to shortest path: 234.81-360 = -125.19
    const group = { id: 'g', colors: ['#F92612', '#D70617', '#AF0F21'] };
    const result = recolorGroup(group, '#F92612', '#0000FF');

    // dominant itself maps exactly to the new color
    expect(result['#F92612']).toBe('#0000FF');

    // hand-computed expectation for #D70617 (h=355.12, s=94.57, l=43.33)
    const dominantHsl = hexToHsl('#F92612');
    const newHsl = hexToHsl('#0000FF');
    let hueDelta = newHsl.h - dominantHsl.h;
    hueDelta = ((hueDelta + 180) % 360) - 180;
    const memberHsl = hexToHsl('#D70617');
    const expectedHue = ((memberHsl.h + hueDelta) % 360 + 360) % 360;
    const expectedSat = (memberHsl.s * newHsl.s) / dominantHsl.s;
    const expectedLight = (memberHsl.l * newHsl.l) / dominantHsl.l;
    const expectedHex = hslToHex({ h: expectedHue, s: expectedSat, l: expectedLight });

    expect(result['#D70617']).toBe(expectedHex);
  });

  it('falls back to additive delta when the dominant color has zero saturation', () => {
    const group = { id: 'g', colors: ['#808080'] };
    const result = recolorGroup(group, '#808080', '#FF0000');
    // s ratio undefined (0/0) -> additive fallback: memberSat + (100 - 0) = 100
    expect(hexToHsl(result['#808080']).s).toBeCloseTo(100, 0);
  });
});

describe('applyColorMap', () => {
  it('substitutes both attribute and style forms, case-insensitively', () => {
    const svg = `<svg><path fill="#f92612" /><path style="fill:#F92612;stroke:#D70617;" /></svg>`;
    const result = applyColorMap(svg, { '#F92612': '#0000FF', '#D70617': '#00FF00' });
    expect(result).toBe(`<svg><path fill="#0000FF" /><path style="fill:#0000FF;stroke:#00FF00;" /></svg>`);
  });

  it('leaves colors outside the map untouched', () => {
    const svg = `<svg><path fill="#ABCDEF" /></svg>`;
    expect(applyColorMap(svg, { '#000000': '#FFFFFF' })).toBe(svg);
  });

  it('returns markup unchanged for an empty map', () => {
    const svg = `<svg><path fill="#ABCDEF" /></svg>`;
    expect(applyColorMap(svg, {})).toBe(svg);
  });
});
