import {
  applyColorMap,
  extractColorGroups,
  groupExtractedColors,
  hexToHsl,
  hslToHex,
  recolorGroup,
} from './color-utils';

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

/** Convenience: run a flat-fill SVG through the real gradient-aware pipeline and return its flat colors. */
function extractFlat(svgMarkup: string): string[] {
  return extractColorGroups(svgMarkup).flatColors;
}

/** Convenience: extract + group a flat-fill SVG through the real gradient-aware pipeline. */
function extractAndGroup(svgMarkup: string) {
  return groupExtractedColors(extractColorGroups(svgMarkup));
}

describe('extractColorGroups - flat fill/stroke extraction', () => {
  it('extracts colors from inline style="fill:#RRGGBB;" (real Noto sedan colors)', () => {
    expect(extractFlat(sedanSvg())).toEqual([
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
    const colors = extractFlat(suvSvg());
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
    expect(extractFlat(svg)).toEqual(['#AABBCC', '#112233']);
  });

  it('handles both attribute and style-property forms for fill and stroke', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <path fill="#FF0000" stroke="#00FF00" />
        <path style="fill: #0000FF; stroke: #FFFF00;" />
      </svg>`;
    expect(extractFlat(svg)).toEqual(['#FF0000', '#00FF00', '#0000FF', '#FFFF00']);
  });
});

/**
 * Representative snippet built from the real Noto grinning-face SVG
 * (emoji_u1f600.svg, https://github.com/googlefonts/noto-emoji), which
 * defines its yellow skin entirely via a `<radialGradient>` with `<stop
 * style="stop-color:...">` children rather than a flat fill.
 */
function grinningFaceGradientSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg">
    <radialGradient id="face_1_" cx="12" cy="17" r="16">
      <stop offset="0.5" style="stop-color:#FDE030"/>
      <stop offset="0.92" style="stop-color:#F7C02B"/>
      <stop offset="1" style="stop-color:#F4A223"/>
    </radialGradient>
    <path style="fill:url(#face_1_);" d="M0,0z"/>
  </svg>`;
}

/**
 * Real Noto grinning-face SVG (emoji_u1f600.svg,
 * https://github.com/googlefonts/noto-emoji, fetched via
 * cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f600.svg),
 * trimmed to the color-bearing elements. Colors present: the face's yellow
 * radial-gradient stops (#FDE030/#F7C02B/#F4A223), the near-black eye/mouth
 * "ink" outline (#422B0D), mouth interior shading (#896024), mouth fill
 * (#EB8F00), a light pink mouth highlight (#ED7770), and white (#FFFFFF).
 */
function grinningFaceSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg">
    <radialGradient id="face_1_" cx="63.22" cy="216.9" r="56.9597">
      <stop offset="0.5" style="stop-color:#FDE030"/>
      <stop offset="0.92" style="stop-color:#F7C02B"/>
      <stop offset="1" style="stop-color:#F4A223"/>
    </radialGradient>
    <path id="face" style="fill:url(#face_1_);" d="M0,0z"/>
    <path style="fill:#422B0D;" d="M0,0z"/>
    <path style="fill:#896024;" d="M0,0z"/>
    <path style="fill:#422B0D;" d="M0,0z"/>
    <path style="fill:#896024;" d="M0,0z"/>
    <path style="fill:#EB8F00;" d="M0,0z"/>
    <path style="fill:#ED7770;" d="M0,0z"/>
    <path style="fill:#FFFFFF;" d="M0,0z"/>
    <path style="fill:#EB8F00;" d="M0,0z"/>
  </svg>`;
}

describe('extractColorGroups - gradient stop extraction', () => {
  it('extracts stop-color from inline style on <stop> elements (real Noto grinning-face gradient)', () => {
    const { gradientGroups, flatColors } = extractColorGroups(grinningFaceGradientSvg());
    expect(gradientGroups).toEqual([['#FDE030', '#F7C02B', '#F4A223']]);
    expect(flatColors).toEqual([]);
  });

  it('extracts stop-color from the stop-color attribute form', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="g">
        <stop offset="0" stop-color="#112233" />
        <stop offset="1" stop-color="#445566" />
      </linearGradient>
    </svg>`;
    expect(extractColorGroups(svg).gradientGroups).toEqual([['#112233', '#445566']]);
  });

  it('groups gradient stops by their owning <linearGradient>/<radialGradient>, separately from flat colors (real Noto fire gradients)', () => {
    const { gradientGroups, flatColors } = extractColorGroups(fireSvg());
    expect(gradientGroups).toEqual([
      ['#FF9800', '#FF6D00', '#F44336'],
      ['#FFF176', '#FFF9C4'],
    ]);
    expect(flatColors).toEqual([]);
  });

  it('puts non-stop fill/stroke colors in flatColors, excluding anything already owned by a gradient', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="g">
        <stop offset="0" stop-color="#112233" />
        <stop offset="1" stop-color="#445566" />
      </linearGradient>
      <path fill="url(#g)" d="M0,0z" />
      <path fill="#778899" d="M0,0z" />
      <path fill="#112233" d="M0,0z" />
    </svg>`;
    const { gradientGroups, flatColors } = extractColorGroups(svg);
    expect(gradientGroups).toEqual([['#112233', '#445566']]);
    // #778899 is a genuinely separate flat color; #112233 is dropped from
    // flatColors because it's already captured as a gradient stop.
    expect(flatColors).toEqual(['#778899']);
  });

  it('skips gradients that resolve to zero colors', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="empty"></linearGradient>
      <path fill="#ABCDEF" d="M0,0z" />
    </svg>`;
    const { gradientGroups, flatColors } = extractColorGroups(svg);
    expect(gradientGroups).toEqual([]);
    expect(flatColors).toEqual(['#ABCDEF']);
  });

  it('produces no gradient groups on plain flat-fill SVGs with no gradients (sedan/SUV unaffected)', () => {
    const sedanExtracted = extractColorGroups(sedanSvg());
    expect(sedanExtracted.gradientGroups).toEqual([]);

    const suvExtracted = extractColorGroups(suvSvg());
    expect(suvExtracted.gradientGroups).toEqual([]);
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

describe('groupExtractedColors - hue clustering', () => {
  it('does not group sedan gray (#C8C8C8, achromatic) with the red family', () => {
    const groups = extractAndGroup(sedanSvg());

    const grayGroup = groups.find((g) => g.colors.includes('#C8C8C8'));
    expect(grayGroup?.colors).toEqual(['#C8C8C8']);

    const redGroup = groups.find((g) => g.colors.includes('#F92612'));
    expect(redGroup?.colors).toEqual(expect.arrayContaining(['#F92612', '#D70617', '#AF0F21']));
    expect(redGroup?.colors).not.toContain('#C8C8C8');
  });

  it('keeps SUV blue-body and window-glass teal as separate groups', () => {
    const groups = extractAndGroup(suvSvg());

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
    const extracted = { gradientGroups: [], flatColors: ['#808080', '#FF0000'] };
    const groups = groupExtractedColors(extracted, { satThreshold: 15 });
    const grayGroup = groups.find((g) => g.colors.includes('#808080'));
    expect(grayGroup?.colors).toEqual(['#808080']);
  });

  it('groups colors within the hue distance threshold, wrapping around 0/360', () => {
    // hues near 0/360 boundary should still cluster together
    const extracted = { gradientGroups: [], flatColors: ['#FF0000', '#FF0505'] };
    const groups = groupExtractedColors(extracted, { hueDistance: 11, satThreshold: 15 });
    expect(groups.length).toBe(1);
    expect(groups[0].colors).toEqual(expect.arrayContaining(['#FF0000', '#FF0505']));
  });

  it('does not group the grinning-face eye/mouth "ink" (#422B0D, dark but well-saturated) with the yellow face gradient', () => {
    const groups = extractAndGroup(grinningFaceSvg());

    // #422B0D: h=34.0, s=67.1%, l=15.5% - saturated but very dark, gated by minLightness.
    const inkGroup = groups.find((g) => g.colors.includes('#422B0D'));
    expect(inkGroup?.colors).toEqual(['#422B0D']);

    // The three yellow gradient stops should still hue-chain together as the face's "skin" family.
    const faceGroup = groups.find((g) => g.colors.includes('#FDE030'));
    expect(faceGroup?.colors).toEqual(expect.arrayContaining(['#FDE030', '#F7C02B', '#F4A223']));
    expect(faceGroup?.colors).not.toContain('#422B0D');
  });

  it('gates hue-clustering by maxLightness: near-white colors are never grouped, even if hue-adjacent', () => {
    // Synthetic near-white (h=40, s=80%, l=95%) placed hue-adjacent to a normal mid-tone orange.
    const nearWhite = hslToHex({ h: 40, s: 80, l: 95 });
    const midtone = hslToHex({ h: 45, s: 80, l: 50 });
    const extracted = { gradientGroups: [], flatColors: [nearWhite, midtone] };
    const groups = groupExtractedColors(extracted);

    const whiteGroup = groups.find((g) => g.colors.includes(nearWhite));
    expect(whiteGroup?.colors).toEqual([nearWhite]);
  });

  it('does not over-gate normal mid-lightness shading (sedan reds, L 37-52%, stay grouped)', () => {
    const groups = extractAndGroup(sedanSvg());

    const redGroup = groups.find((g) => g.colors.includes('#F92612'));
    // #F92612 l=52.4%, #D70617 l=43.3%, #AF0F21 l=37.1% - all comfortably inside [20,90].
    expect(redGroup?.colors).toEqual(expect.arrayContaining(['#F92612', '#D70617', '#AF0F21']));
  });
});

/**
 * Real Noto fire-emoji flame gradient (emoji_u1f525.svg,
 * https://github.com/googlefonts/noto-emoji, fetched via
 * cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f525.svg),
 * reduced to its color-bearing elements. `SVGID_1_` is the flame's
 * orange->red gradient (spans ~31.7° of hue); `SVGID_2_` is a separate
 * yellow glow gradient, structurally unrelated to the flame.
 */
function fireSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg">
    <radialGradient id="SVGID_1_" cx="24" cy="20" r="15">
      <stop offset="0.3" style="stop-color:#FF9800"/>
      <stop offset="0.6" style="stop-color:#FF6D00"/>
      <stop offset="1" style="stop-color:#F44336"/>
    </radialGradient>
    <path style="fill:url(#SVGID_1_);" d="M0,0z"/>
    <radialGradient id="SVGID_2_" cx="24" cy="24" r="15">
      <stop offset="0.4" style="stop-color:#FFF176"/>
      <stop offset="1" style="stop-color:#FFF9C4"/>
    </radialGradient>
    <path style="fill:url(#SVGID_2_);" d="M0,0z"/>
  </svg>`;
}

describe('groupExtractedColors - structural gradient grouping', () => {
  it("keeps the real Noto fire flame's 3 gradient stops in one group, unconditionally (they always did chain via the old threshold too - this just confirms it now holds by construction)", () => {
    const groups = extractAndGroup(fireSvg());

    const flameGroup = groups.find((g) => g.colors.includes('#FF9800'));
    expect(flameGroup?.colors).toEqual(expect.arrayContaining(['#FF9800', '#FF6D00', '#F44336']));
  });

  it('SYNTHETIC: keeps gradient stops together even when an adjacent-stop hue jump exceeds hueDistance, which naive per-step flat hue-chaining could NOT have chained', () => {
    // Three synthetic stops 20° apart in hue (0, 20, 40) - each individual
    // step exceeds the default 11° hueDistance, so naive flat hue-chaining
    // over the bare colors (bypassing gradient grouping entirely) would
    // split these into 3 singleton groups.
    const stop1 = hslToHex({ h: 0, s: 80, l: 50 });
    const stop2 = hslToHex({ h: 20, s: 80, l: 50 });
    const stop3 = hslToHex({ h: 40, s: 80, l: 50 });

    // Prove naive per-step chaining over the same colors as independent
    // flat units actually fails on this input.
    const naiveGroups = groupExtractedColors({ gradientGroups: [], flatColors: [stop1, stop2, stop3] });
    expect(naiveGroups.length).toBe(3);

    // The structural fix bundles them unconditionally as one pre-formed
    // gradient group, regardless of per-step hue distance.
    const extracted = { gradientGroups: [[stop1, stop2, stop3]], flatColors: [] };
    const groups = groupExtractedColors(extracted);
    expect(groups.length).toBe(1);
    expect(groups[0].colors).toEqual([stop1, stop2, stop3]);
  });

  it('merges a gradient with an adjacent-hue flat color via its dominant (first) stop, same as normal cross-group clustering', () => {
    const gradientStops = [hslToHex({ h: 30, s: 70, l: 50 }), hslToHex({ h: 35, s: 70, l: 45 })];
    // Within hueDistance (11°) of the gradient's dominant stop hue (30°).
    const nearbyFlat = hslToHex({ h: 38, s: 70, l: 55 });

    const extracted = { gradientGroups: [gradientStops], flatColors: [nearbyFlat] };
    const groups = groupExtractedColors(extracted);

    const merged = groups.find((g) => g.colors.includes(nearbyFlat));
    expect(merged?.colors).toEqual(expect.arrayContaining([...gradientStops, nearbyFlat]));
  });

  it('does not merge a gradient with a clearly unrelated-hue flat color (gradient-vs-flat separation still works, like SUV body/glass)', () => {
    const gradientStops = [hslToHex({ h: 30, s: 70, l: 50 }), hslToHex({ h: 35, s: 70, l: 45 })];
    // Far outside hueDistance of the gradient's dominant stop hue.
    const unrelatedFlat = hslToHex({ h: 200, s: 70, l: 50 });

    const extracted = { gradientGroups: [gradientStops], flatColors: [unrelatedFlat] };
    const groups = groupExtractedColors(extracted);

    const gradientGroup = groups.find((g) => g.colors.includes(gradientStops[0]));
    const flatGroup = groups.find((g) => g.colors.includes(unrelatedFlat));
    expect(gradientGroup!.id).not.toBe(flatGroup!.id);
    expect(gradientGroup!.colors).not.toContain(unrelatedFlat);
  });

  it('does not merge two unrelated-hue gradients into one group', () => {
    const gradientA = [hslToHex({ h: 10, s: 70, l: 50 })];
    const gradientB = [hslToHex({ h: 180, s: 70, l: 50 })];
    const extracted = { gradientGroups: [gradientA, gradientB], flatColors: [] };
    const groups = groupExtractedColors(extracted);

    const groupA = groups.find((g) => g.colors.includes(gradientA[0]));
    const groupB = groups.find((g) => g.colors.includes(gradientB[0]));
    expect(groupA!.id).not.toBe(groupB!.id);
  });

  it('a gradient whose dominant stop is desaturated/extreme-lightness is treated as a gated singleton for cross-group purposes, but its own stops stay together', () => {
    // Dominant stop is near-white (gated by maxLightness); second stop is a normal mid-tone.
    const nearWhiteDominant = hslToHex({ h: 40, s: 80, l: 95 });
    const midtoneStop = hslToHex({ h: 42, s: 80, l: 50 });
    const extracted = { gradientGroups: [[nearWhiteDominant, midtoneStop]], flatColors: [] };
    const groups = groupExtractedColors(extracted);

    // Exactly one group, containing both stops - never split.
    expect(groups.length).toBe(1);
    expect(groups[0].colors).toEqual([nearWhiteDominant, midtoneStop]);
  });

  it('regression: sedan/SUV grouping is unaffected by the gradient-aware pipeline (no gradients present)', () => {
    const sedanGroups = extractAndGroup(sedanSvg());
    const grayGroup = sedanGroups.find((g) => g.colors.includes('#C8C8C8'));
    expect(grayGroup?.colors).toEqual(['#C8C8C8']);
    const redGroup = sedanGroups.find((g) => g.colors.includes('#F92612'));
    expect(redGroup?.colors).toEqual(expect.arrayContaining(['#F92612', '#D70617', '#AF0F21']));

    const suvGroups = extractAndGroup(suvSvg());
    const blueGroup = suvGroups.find((g) => g.colors.includes('#0250AC'));
    const tealGroup = suvGroups.find((g) => g.colors.includes('#506D71'));
    expect(blueGroup!.id).not.toBe(tealGroup!.id);
  });

  it('regression: grinning-face eye/mouth "ink" (#422B0D) stays isolated from the face gradient (flat-color gate unaffected by gradient grouping)', () => {
    const groups = extractAndGroup(grinningFaceSvg());

    const inkGroup = groups.find((g) => g.colors.includes('#422B0D'));
    expect(inkGroup?.colors).toEqual(['#422B0D']);

    const faceGroup = groups.find((g) => g.colors.includes('#FDE030'));
    expect(faceGroup?.colors).toEqual(expect.arrayContaining(['#FDE030', '#F7C02B', '#F4A223']));
    expect(faceGroup?.colors).not.toContain('#422B0D');
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

  it('rewrites gradient stop-colors (attribute and style-property forms), leaving structure/offsets intact', () => {
    const svg = grinningFaceGradientSvg();
    const result = applyColorMap(svg, {
      '#FDE030': '#00FF00',
      '#F7C02B': '#0000FF',
      '#F4A223': '#FF0000',
    });
    expect(result).toContain('<stop offset="0.5" style="stop-color:#00FF00"/>');
    expect(result).toContain('<stop offset="0.92" style="stop-color:#0000FF"/>');
    expect(result).toContain('<stop offset="1" style="stop-color:#FF0000"/>');
    expect(result).toContain('id="face_1_"');
    expect(result).toContain('fill:url(#face_1_);');
  });
});
