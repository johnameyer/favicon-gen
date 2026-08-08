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
 * Extracts every distinct color used in `fill`/`stroke` attributes and their
 * inline `style="..."` equivalents from SVG markup, in first-encountered
 * order. Colors are normalized to uppercase 6-digit hex; non-hex values
 * (named colors, `url(#...)`, `none`, `currentColor`, etc.) are ignored, as
 * are duplicates and short (#RGB) forms are expanded.
 */
export function extractColors(svgMarkup: string): string[] {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  const addCandidate = (raw: string | null): void => {
    if (!raw) {
      return;
    }
    const hex = normalizeColor(raw.trim());
    if (!hex || seen.has(hex)) {
      return;
    }
    seen.add(hex);
    result.push(hex);
  };

  const elements = doc.querySelectorAll('*');
  for (const el of Array.from(elements)) {
    addCandidate(el.getAttribute('fill'));
    addCandidate(el.getAttribute('stroke'));

    const style = el.getAttribute('style');
    if (style) {
      for (const prop of style.split(';')) {
        const [name, value] = prop.split(':').map((part) => part.trim());
        if ((name === 'fill' || name === 'stroke') && value) {
          addCandidate(value);
        }
      }
    }
  }

  return result;
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
}

/**
 * Groups colors into suggested "families" by hue proximity, gated by
 * saturation to avoid pulling achromatic grays/whites/blacks (whose hue is
 * numerically unstable/meaningless) into an unrelated hue cluster.
 *
 * Colors below `satThreshold` are never hue-clustered - each becomes its own
 * single-color group. Colors at/above the threshold are sorted by hue and
 * chained (single-linkage) into a group whenever adjacent hues are within
 * `hueDistance` of each other, including wraparound across 0/360.
 *
 * This is a *suggestion*: callers (the recolor panel) let users split or
 * merge groups afterward, since a fixed threshold can't perfectly separate
 * every case (e.g. adjacent-hue but semantically distinct materials).
 */
export function groupColorsByHue(colors: string[], options?: GroupColorsOptions): ColorGroup[] {
  const satThreshold = options?.satThreshold ?? 15;
  const hueDistance = options?.hueDistance ?? 11;

  const chromatic: { color: string; hsl: Hsl }[] = [];
  const groups: ColorGroup[] = [];
  let groupCounter = 0;

  for (const color of colors) {
    const hsl = hexToHsl(color);
    if (hsl.s < satThreshold) {
      groups.push({ id: `group-${groupCounter++}`, colors: [color] });
    } else {
      chromatic.push({ color, hsl });
    }
  }

  chromatic.sort((a, b) => a.hsl.h - b.hsl.h);

  const chromaticGroups: string[][] = [];
  for (const { color, hsl } of chromatic) {
    const lastGroup = chromaticGroups[chromaticGroups.length - 1];
    if (lastGroup) {
      const lastColorHue = hexToHsl(lastGroup[lastGroup.length - 1]).h;
      if (hueDistanceBetween(lastColorHue, hsl.h) <= hueDistance) {
        lastGroup.push(color);
        continue;
      }
    }
    chromaticGroups.push([color]);
  }

  // Check wraparound: merge the last chromatic group into the first if they're
  // adjacent across the 0/360 boundary (and they aren't already the same group).
  if (chromaticGroups.length > 1) {
    const first = chromaticGroups[0];
    const last = chromaticGroups[chromaticGroups.length - 1];
    const firstHue = hexToHsl(first[0]).h;
    const lastHue = hexToHsl(last[last.length - 1]).h;
    if (hueDistanceBetween(lastHue, firstHue) <= hueDistance) {
      chromaticGroups.pop();
      chromaticGroups[0] = [...last, ...first];
    }
  }

  for (const groupColors of chromaticGroups) {
    groups.push({ id: `group-${groupCounter++}`, colors: groupColors });
  }

  return groups;
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
