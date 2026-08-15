/**
 * Pure, framework-free color extraction / clustering / recoloring math for
 * SVG markup. No Angular dependencies so this is trivially unit-testable in
 * isolation.
 */

/** A suggested (or user-edited) group of original colors treated as one "family". */
export interface ColorGroup {
  /** Stable identifier for tracking a group across UI edits (not derived from color values). */
  id: string;
  /** Original hex colors (uppercase `#RRGGBB`) belonging to this group, in first-seen order. */
  colors: string[];
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const NON_COLOR_VALUES = new Set(['none', 'transparent', 'currentcolor']);

/**
 * The output of `extractColorGroups`: gradient-owned color groups kept
 * separate from ungrouped flat colors, so that gradient-aware callers (see
 * `groupExtractedColors`) can treat each gradient's stops as one atomic
 * unit instead of flattening everything into a single list.
 */
export interface ExtractedColors {
  /** One entry per gradient, colors in document (stop) order. */
  gradientGroups: string[][];
  /** Non-gradient `fill`/`stroke` colors, in first-seen document order. */
  flatColors: string[];
}

/**
 * Extracts every distinct color used in `fill`/`stroke` attributes (and
 * their inline `style="..."` equivalents) from SVG markup, keeping colors
 * that belong to the same `<linearGradient>`/`<radialGradient>` grouped
 * together instead of flattened into one list. Colors are normalized to
 * uppercase 6-digit hex; non-hex values (named colors, `url(#...)`, `none`,
 * `currentColor`, etc.) are ignored, as are duplicates, and short (#RGB)
 * forms are expanded.
 *
 * Gradient stops matter because many Noto emoji (most faces, plus some
 * "glowing" subjects like sun/moon/fire) define their color entirely via
 * `<radialGradient>`/`<linearGradient>` `<stop>` children rather than a flat
 * `fill="#hex"` - without this, those SVGs would show zero recolorable
 * swatches.
 *
 * Real Noto gradients frequently span far more hue distance than any fixed
 * clustering threshold could reasonably accommodate (e.g. the birthday-cake
 * emoji's frosting gradients go pink->orange->yellow across ~64° of hue) -
 * because a gradient's stops are, by construction, one continuous visual
 * material regardless of how far their colors drift. The SVG itself already
 * unambiguously declares this via shared parentage, so gradient stops are
 * extracted here as pre-formed groups that `groupExtractedColors` can treat
 * as atomic, bypassing hue/saturation/lightness clustering for their own
 * internal members entirely.
 *
 * Returns two lists:
 *  - `gradientGroups`: one entry per `<linearGradient>`/`<radialGradient>`
 *    with at least one resolved stop color, colors in document (stop) order
 *    - so `colors[0]` is a reasonable "dominant" pick, consistent with the
 *    `group.colors[0]` convention used elsewhere (see `recolorGroup`).
 *  - `flatColors`: every other color found via `fill`/`stroke` (attribute +
 *    style forms) on non-`<stop>` elements that isn't already captured as a
 *    gradient stop, in first-seen document order.
 */
export function extractColorGroups(svgMarkup: string): ExtractedColors {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    return { gradientGroups: [], flatColors: [] };
  }

  const addStyleProps = (style: string | null, propNames: string[], out: (value: string) => void): void => {
    if (!style) {
      return;
    }
    for (const prop of style.split(';')) {
      const [name, value] = prop.split(':').map((part) => part.trim());
      if (name && propNames.includes(name) && value) {
        out(value);
      }
    }
  };

  const stopOwnedColors = new Set<string>();
  const gradientGroups: string[][] = [];

  const gradients = doc.querySelectorAll('linearGradient, radialGradient');
  for (const gradient of Array.from(gradients)) {
    const seen = new Set<string>();
    const groupColors: string[] = [];
    const addCandidate = (raw: string | null): void => {
      if (!raw) {
        return;
      }
      const hex = normalizeColor(raw.trim());
      if (!hex || seen.has(hex)) {
        return;
      }
      seen.add(hex);
      groupColors.push(hex);
      stopOwnedColors.add(hex);
    };

    const stops = gradient.querySelectorAll('stop');
    for (const stop of Array.from(stops)) {
      addCandidate(stop.getAttribute('stop-color'));
      addStyleProps(stop.getAttribute('style'), ['stop-color'], addCandidate);
    }

    if (groupColors.length > 0) {
      gradientGroups.push(groupColors);
    }
  }

  const flatSeen = new Set<string>();
  const flatColors: string[] = [];
  const addFlatCandidate = (raw: string | null): void => {
    if (!raw) {
      return;
    }
    const hex = normalizeColor(raw.trim());
    if (!hex || flatSeen.has(hex) || stopOwnedColors.has(hex)) {
      return;
    }
    flatSeen.add(hex);
    flatColors.push(hex);
  };

  const elements = doc.querySelectorAll('*');
  for (const el of Array.from(elements)) {
    if (el.tagName.toLowerCase() === 'stop') {
      continue;
    }
    addFlatCandidate(el.getAttribute('fill'));
    addFlatCandidate(el.getAttribute('stroke'));
    addStyleProps(el.getAttribute('style'), ['fill', 'stroke'], addFlatCandidate);
  }

  return { gradientGroups, flatColors };
}

/** Normalizes a CSS color value to uppercase `#RRGGBB`, or null if it isn't a plain hex color. */
function normalizeColor(value: string): string | null {
  const lower = value.toLowerCase();
  if (NON_COLOR_VALUES.has(lower)) {
    return null;
  }
  const match = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${hex.toUpperCase()}`;
}

/** Converts a `#RRGGBB` hex color to HSL (h in [0,360), s/l in [0,100]). */
export function hexToHsl(hex: string): Hsl {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

/** Converts an HSL color (h in degrees, s/l in [0,100]) to uppercase `#RRGGBB` hex. */
export function hslToHex(hsl: Hsl): string {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return toHex(gray, gray, gray);
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h / 360 + 1 / 3);
  const g = hueToRgb(p, q, h / 360);
  const b = hueToRgb(p, q, h / 360 - 1 / 3);

  return toHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

function hueToRgb(p: number, q: number, tIn: number): number {
  let t = tIn;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function toHex(r: number, g: number, b: number): string {
  const part = (n: number) => clamp(n, 0, 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Removes duplicate hex values, preserving first-seen order. */
function dedupe(colors: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const color of colors) {
    if (!seen.has(color)) {
      seen.add(color);
      result.push(color);
    }
  }
  return result;
}

/** Shortest-path circular distance between two hue angles in degrees, in [0, 180]. */
function hueDistanceBetween(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export interface GroupColorsOptions {
  /** Minimum saturation (%) required for a color to participate in hue clustering. Default 15. */
  satThreshold?: number;
  /** Maximum hue distance (degrees) between adjacent colors to be chained into the same group. Default 11. */
  hueDistance?: number;
  /** Minimum lightness (%) required for a color to participate in hue clustering. Default 20. */
  minLightness?: number;
  /** Maximum lightness (%) required for a color to participate in hue clustering. Default 90. */
  maxLightness?: number;
}

/**
 * An atomic unit fed into the hue-chaining algorithm: either a single flat
 * color, or a whole pre-formed gradient (all of one `<linearGradient>`'s /
 * `<radialGradient>'s `<stop>` colors), represented for clustering purposes
 * by `hsl` (by convention, the hue/sat/lightness of `colors[0]`, the
 * "dominant" stop - see `recolorGroup`'s doc comment for the same
 * convention applied at recolor time).
 */
interface ColorUnit {
  colors: string[];
  hsl: Hsl;
}

/**
 * Groups color units into suggested "families" by hue proximity, gated by
 * saturation and lightness to avoid pulling achromatic grays/whites/blacks
 * (whose hue is numerically unstable/meaningless), or colors at extreme
 * lightness (whose hue is well-defined but which function as "ink"/"highlight"
 * accents rather than a genuine material family), into an unrelated hue
 * cluster.
 *
 * Units below `satThreshold`, or with lightness below `minLightness` or
 * above `maxLightness` (checked against the unit's representative `hsl`),
 * are never hue-clustered - each becomes its own single-unit group. This is
 * deliberately a simple "achromatic-or-extreme" gate: gated units are *not*
 * clustered among themselves here, even if several of them share a hue
 * (that's an intentionally separate, unscoped follow-up).
 *
 * The lightness gate matters because saturation and lightness are
 * independent axes: a color can be dark (or near-white) *and* well-saturated
 * at the same time - e.g. a near-black "ink" outline color used for eyes and
 * mouth lines can have a perfectly legitimate, non-trivial hue despite being
 * essentially a shadow/outline accent rather than part of a face's skin-tone
 * family. Without this gate, single-linkage hue-chaining can bridge such an
 * extreme through a chain of intermediate mid-tone colors (e.g. mouth
 * shading/fill) all the way to an unrelated bright color family (e.g. a
 * face's yellow skin gradient), merging visually and semantically unrelated
 * elements into one group purely because every adjacent step in the sorted
 * hue chain happens to be within `hueDistance`.
 *
 * Units passing both gates are sorted by hue and chained (single-linkage)
 * into a group whenever adjacent hues are within `hueDistance` of each
 * other, including wraparound across 0/360.
 *
 * This is the shared engine behind `groupExtractedColors`, generalized to
 * operate on pre-formed "units" rather than bare colors, so that a
 * gradient's stops (which must *always* stay together, unconditionally -
 * see `extractColorGroups`) can be threaded through the exact same
 * single-linkage hue-chaining algorithm used for individual flat colors,
 * participating in cross-group merges via their representative `hsl` while
 * keeping all of their member colors bundled as one indivisible unit
 * whenever they do merge with something.
 *
 * This is a *suggestion*: callers (the recolor panel) let users split or
 * merge groups afterward, since a fixed threshold can't perfectly separate
 * every case (e.g. adjacent-hue but semantically distinct materials).
 */
function groupColorUnitsByHue(units: ColorUnit[], options?: GroupColorsOptions): ColorGroup[] {
  const satThreshold = options?.satThreshold ?? 15;
  const hueDistance = options?.hueDistance ?? 11;
  const minLightness = options?.minLightness ?? 20;
  const maxLightness = options?.maxLightness ?? 90;

  const chromatic: ColorUnit[] = [];
  const groups: ColorGroup[] = [];
  let groupCounter = 0;

  for (const unit of units) {
    const { hsl } = unit;
    if (hsl.s < satThreshold || hsl.l < minLightness || hsl.l > maxLightness) {
      groups.push({ id: `group-${groupCounter++}`, colors: unit.colors });
    } else {
      chromatic.push(unit);
    }
  }

  chromatic.sort((a, b) => a.hsl.h - b.hsl.h);

  const chromaticGroups: ColorUnit[][] = [];
  for (const unit of chromatic) {
    const lastGroup = chromaticGroups[chromaticGroups.length - 1];
    if (lastGroup) {
      const lastHue = lastGroup[lastGroup.length - 1].hsl.h;
      if (hueDistanceBetween(lastHue, unit.hsl.h) <= hueDistance) {
        lastGroup.push(unit);
        continue;
      }
    }
    chromaticGroups.push([unit]);
  }

  // Check wraparound: merge the last chromatic group into the first if they're
  // adjacent across the 0/360 boundary (and they aren't already the same group).
  if (chromaticGroups.length > 1) {
    const first = chromaticGroups[0];
    const last = chromaticGroups[chromaticGroups.length - 1];
    const firstHue = first[0].hsl.h;
    const lastHue = last[last.length - 1].hsl.h;
    if (hueDistanceBetween(lastHue, firstHue) <= hueDistance) {
      chromaticGroups.pop();
      chromaticGroups[0] = [...last, ...first];
    }
  }

  for (const groupUnits of chromaticGroups) {
    groups.push({ id: `group-${groupCounter++}`, colors: dedupe(groupUnits.flatMap((u) => u.colors)) });
  }

  return groups;
}

/**
 * Groups the output of `extractColorGroups` into suggested color
 * "families": gradient pre-groups (`extracted.gradientGroups`) are threaded
 * through `groupColorUnitsByHue` as atomic units - never split by this
 * function, however far their own stops span in hue - while remaining
 * eligible to hue-chain with other gradients or flat colors via their
 * dominant (first) stop, exactly like any flat color would. This is the
 * function `RecolorPanel` calls whenever gradient-awareness matters (i.e.
 * always, for real SVG input).
 */
export function groupExtractedColors(extracted: ExtractedColors, options?: GroupColorsOptions): ColorGroup[] {
  const units: ColorUnit[] = [
    ...extracted.gradientGroups.map((colors) => ({ colors, hsl: hexToHsl(colors[0]) })),
    ...extracted.flatColors.map((color) => ({ colors: [color], hsl: hexToHsl(color) })),
  ];
  return groupColorUnitsByHue(units, options);
}

/**
 * Computes the {originalColor: newColor} map for recoloring a group.
 *
 * `dominantColor` is the reference color the user picked a new color *for*
 * (by convention, the first color added to the group / `group.colors[0]`
 * unless the caller has a better notion of "most surface area").
 *
 * Hue is applied as an additive offset (shortest-path delta, wrapped to
 * [0,360)). Saturation and lightness are applied as ratios relative to the
 * dominant color, preserving each member's relative shading rather than
 * flattening it - this is what keeps a 3-tone shaded body looking shaded
 * after recoloring instead of going flat.
 */
export function recolorGroup(group: ColorGroup, dominantColor: string, newColor: string): Record<string, string> {
  const dominantHsl = hexToHsl(dominantColor);
  const newHsl = hexToHsl(newColor);

  let hueDelta = newHsl.h - dominantHsl.h;
  hueDelta = ((hueDelta + 180) % 360) - 180;
  if (hueDelta < -180) hueDelta += 360;

  const satRatio = dominantHsl.s === 0 ? null : newHsl.s / dominantHsl.s;
  const lightRatio = dominantHsl.l === 0 ? null : newHsl.l / dominantHsl.l;

  const result: Record<string, string> = {};
  for (const originalColor of group.colors) {
    const originalHsl = hexToHsl(originalColor);

    const memberNewHue = ((originalHsl.h + hueDelta) % 360 + 360) % 360;
    const memberNewSat = clamp(
      satRatio === null ? originalHsl.s + (newHsl.s - dominantHsl.s) : originalHsl.s * satRatio,
      0,
      100,
    );
    const memberNewLight = clamp(
      lightRatio === null ? originalHsl.l + (newHsl.l - dominantHsl.l) : originalHsl.l * lightRatio,
      0,
      100,
    );

    result[originalColor] = hslToHex({ h: memberNewHue, s: memberNewSat, l: memberNewLight });
  }

  return result;
}

/**
 * Substitutes colors in SVG markup according to `colorMap` ({originalHex:
 * newHex}), matching both `fill="..."`/`stroke="..."` attribute forms and
 * `style="fill:...;stroke:...;"` inline-style forms. Matching against the
 * original hex is case-insensitive (SVGs may use lowercase hex); output uses
 * the case of `newColor` as given by the caller.
 */
export function applyColorMap(svgMarkup: string, colorMap: Record<string, string>): string {
  const lookup = new Map<string, string>();
  for (const [original, next] of Object.entries(colorMap)) {
    lookup.set(original.toUpperCase(), next);
  }
  if (lookup.size === 0) {
    return svgMarkup;
  }

  return svgMarkup.replace(HEX_COLOR_RE, (match) => {
    const normalized = normalizeColor(match);
    if (!normalized) {
      return match;
    }
    const replacement = lookup.get(normalized);
    return replacement ?? match;
  });
}
