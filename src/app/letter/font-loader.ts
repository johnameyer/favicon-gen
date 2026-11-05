/**
 * Loads a user-supplied font so it can be embedded in generated letter SVGs.
 *
 * The SVG is drawn via an `<img>` data URL (see `render-layers.ts`), and an
 * SVG loaded that way can't fetch anything external, so a plain
 * `@font-face { src: url(https://...) }` would be ignored. Instead the font
 * is fetched here and inlined as a base64 data URL.
 *
 * Both a direct font file URL and a stylesheet URL (e.g. Google Fonts'
 * `https://fonts.googleapis.com/css2?family=...`) are accepted. Either way
 * the host has to allow cross-origin requests (CORS); Google Fonts does.
 * A stylesheet can also supply a separate italic file, and a variable font
 * reports its axes (see `font-axes.ts`).
 */

import { readFontAxes } from './font-axes';
import { CustomFont } from './letter-svg';

/** Same 2 MB cap as SVG uploads; a favicon only needs one glyph. */
export const MAX_FONT_SIZE_BYTES = 2 * 1024 * 1024;

const FONT_MIME_BY_EXTENSION: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

interface FontFaceRule {
  src: string;
  /** Inclusive code point ranges from `unicode-range`; empty means "covers everything". */
  ranges: [number, number][];
  /** Declared `font-style: italic`. (Google's `oblique <range>` for slant axes counts as normal.) */
  italic: boolean;
}

/** Parses `@font-face` blocks from a stylesheet: the first `url(...)`, `unicode-range` and italic style. */
export function parseFontFaceRules(css: string, baseUrl: string): FontFaceRule[] {
  const rules: FontFaceRule[] = [];
  for (const [, body] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const src = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(body)?.[1];
    if (!src) {
      continue;
    }
    const rangeValue = /unicode-range\s*:\s*([^;]+)/.exec(body)?.[1] ?? '';
    const ranges = rangeValue
      .split(',')
      .map((part) => part.trim().replace(/^U\+/i, ''))
      .filter(Boolean)
      .map((part): [number, number] => {
        if (part.includes('?')) {
          return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'F'), 16)];
        }
        const [start, end = start] = part.split('-');
        return [parseInt(start, 16), parseInt(end, 16)];
      });
    const italic = /font-style\s*:\s*italic\b/.test(body);
    rules.push({ src: new URL(src, baseUrl).href, ranges, italic });
  }
  return rules;
}

/**
 * Picks the `@font-face` rule of the given style whose `unicode-range`
 * covers `letter`, so stylesheets split into per-script subsets (as Google
 * Fonts' are) load the right file. Falls back to the first rule of that
 * style, or `undefined` if the stylesheet has none.
 */
export function pickFontFaceRule(
  rules: FontFaceRule[],
  letter: string,
  italic = false,
): FontFaceRule | undefined {
  const styled = rules.filter((rule) => rule.italic === italic);
  const codePoint = letter.codePointAt(0);
  const covering = styled.find(
    (rule) =>
      rule.ranges.length === 0 ||
      (codePoint !== undefined &&
        rule.ranges.some(([start, end]) => codePoint >= start && codePoint <= end)),
  );
  return covering ?? styled[0];
}

function fontMimeType(url: string, contentType: string | null): string {
  if (contentType?.startsWith('font/')) {
    return contentType.split(';')[0];
  }
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  return FONT_MIME_BY_EXTENSION[extension] ?? 'font/ttf';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function fetchOrThrow(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    // fetch() only rejects on network/CORS failures, which browsers don't distinguish.
    throw new Error("Couldn't fetch that URL. The server may not allow cross-origin requests.");
  }
  if (!response.ok) {
    throw new Error(`Couldn't fetch that URL (HTTP ${response.status}).`);
  }
  return response;
}

interface FetchedFont {
  bytes: Uint8Array;
  dataUrl: string;
}

/** Turns a font file response into its bytes and an embeddable `data:` URL. */
async function readFontResponse(response: Response, url: string): Promise<FetchedFont> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_FONT_SIZE_BYTES) {
    throw new Error('Font is too large (max 2 MB).');
  }
  const mimeType = fontMimeType(response.url || url, response.headers.get('content-type'));
  return { bytes, dataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}` };
}

async function fetchFont(url: string): Promise<FetchedFont> {
  return readFontResponse(await fetchOrThrow(url), url);
}

/**
 * Fetches a font (directly, or via the stylesheet that references it),
 * embeds it as `data:` URLs and reads its variation axes. `letter` picks
 * the right subset when a stylesheet has several. Throws an `Error` with a
 * user-presentable message on failure.
 */
export async function loadFont(url: string, letter: string): Promise<CustomFont> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('Font URLs must start with http:// or https://.');
  }

  const response = await fetchOrThrow(parsedUrl.href);
  let normal: FetchedFont;
  let italic: FetchedFont | undefined;
  if (response.headers.get('content-type')?.includes('text/css')) {
    const rules = parseFontFaceRules(await response.text(), response.url || parsedUrl.href);
    const normalRule = pickFontFaceRule(rules, letter) ?? rules[0];
    if (!normalRule) {
      throw new Error('That stylesheet has no @font-face font URLs in it.');
    }
    const italicRule = pickFontFaceRule(rules, letter, true);
    [normal, italic] = await Promise.all([
      fetchFont(normalRule.src),
      italicRule && italicRule !== normalRule ? fetchFont(italicRule.src) : undefined,
    ]);
  } else {
    normal = await readFontResponse(response, parsedUrl.href);
  }

  return {
    normal: normal.dataUrl,
    italic: italic?.dataUrl,
    axes: await readFontAxes(normal.bytes),
  };
}
