import { Injectable } from '@angular/core';

/**
 * Default placeholder emoji codepoint fragment (Noto "rocket", U+1F680).
 */
const DEFAULT_EMOJI_CODEPOINTS = '1f680';

/**
 * jsDelivr base URL for googlefonts/noto-emoji, pinned to the commit of the
 * `v2026-09-24-unicode18_0` release.
 *
 * This used to track `@main`, which broke every emoji when upstream
 * restructured the repo on 2026-09-17 ("Add emoji 18 SVGs and change the
 * directory structure": `svg/` moved to `2D/svg/`). Pinning means an
 * upstream reorganization can't break the app again; bump it deliberately
 * (the `emoji-cdn` e2e spec checks the paths still resolve). It's a commit
 * SHA rather than the tag name because jsDelivr 404s on that non-semver tag.
 */
export const NOTO_EMOJI_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e';

/** Inclusive range of regional indicator symbol codepoints (U+1F1E6 'A' .. U+1F1FF 'Z'). */
const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;

/** Black flag base codepoint used to introduce tag-sequence subdivision flags. */
const TAG_SEQUENCE_BASE = 0x1f3f4;
/** Inclusive range of Unicode tag characters used to spell out ASCII in tag sequences. */
const TAG_CHAR_START = 0xe0000;
const TAG_CHAR_END = 0xe007f;
/** Tag sequence terminator (cancel tag). */
const TAG_SEQUENCE_TERMINATOR = 0xe007f;

/**
 * Converts an emoji character (which may be a multi-codepoint ZWJ sequence,
 * e.g. family emoji) into the codepoint filename fragment Noto Emoji uses,
 * e.g. "1f468_200d_1f469_200d_1f467".
 *
 * `Array.from` iterates by Unicode code point (not UTF-16 code unit), so
 * surrogate pairs are handled correctly. Variation selector-16 (U+FE0F) is
 * filtered out because Noto's filenames omit it. Each codepoint is padded
 * to at least 4 hex digits, as Noto's filenames are (e.g. keycap 1️⃣ is
 * "0031_20e3", © is "00a9").
 */
export function emojiToCodepoints(emoji: string): string {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0)!)
    .filter((codePoint) => codePoint !== 0xfe0f)
    .map((codePoint) => codePoint.toString(16).toLowerCase().padStart(4, '0'))
    .join('_');
}

/** Parses a Noto codepoint filename fragment (e.g. "1f1fa_1f1f8") back into numeric code points. */
function parseCodepoints(codepoints: string): number[] {
  return codepoints.split('_').map((hex) => parseInt(hex, 16));
}

/**
 * If `codePoints` is a two-letter regional-indicator pair (e.g. 🇺🇸 = U+1F1FA
 * U+1F1F8), decodes it to its two-letter region code (e.g. "US"). Returns
 * `null` otherwise.
 */
function decodeRegionalIndicatorPair(codePoints: number[]): string | null {
  if (codePoints.length !== 2) return null;
  if (codePoints.some((cp) => cp < REGIONAL_INDICATOR_START || cp > REGIONAL_INDICATOR_END)) {
    return null;
  }
  return codePoints
    .map((cp) => String.fromCharCode(cp - REGIONAL_INDICATOR_START + 'A'.charCodeAt(0)))
    .join('');
}

/**
 * If `codePoints` is a tag-sequence subdivision flag (U+1F3F4 followed by 2+
 * tag characters spelling out an ISO 3166-2 code, terminated by U+E007F),
 * decodes it to its region code (e.g. "GB-ENG"). Returns `null` otherwise.
 */
function decodeTagSequenceFlag(codePoints: number[]): string | null {
  if (codePoints.length < 4) return null;
  if (codePoints[0] !== TAG_SEQUENCE_BASE) return null;
  if (codePoints[codePoints.length - 1] !== TAG_SEQUENCE_TERMINATOR) return null;

  const tagChars = codePoints.slice(1, -1);
  if (tagChars.some((cp) => cp < TAG_CHAR_START || cp > TAG_CHAR_END)) return null;

  const decoded = tagChars.map((cp) => String.fromCharCode(cp - TAG_CHAR_START)).join('');
  if (decoded.length < 3) return null;

  return `${decoded.slice(0, 2).toUpperCase()}-${decoded.slice(2).toUpperCase()}`;
}

/**
 * Resolves the Noto Emoji SVG URL for a given codepoint fragment, routing
 * flag emoji to their actual location on the CDN.
 *
 * Most emoji live under `2D/svg/emoji_u{codepoints}.svg`, but flags do not:
 * - Plain two-letter country flags (regional-indicator pairs, e.g. 🇺🇸) live
 *   under `third_party/region-flags/svg/{CODE}.svg` (e.g. "US.svg").
 * - Subdivision flags (e.g. England/Scotland/Wales, US/Canadian/Mexican
 *   states/provinces) are encoded as Unicode tag sequences and also live
 *   under `third_party/region-flags/svg/{CODE}.svg` (e.g. "GB-ENG.svg").
 * - Simple flag symbols (🏁🚩🎌🏴) and everything else resolve fine via the
 *   normal path already.
 * - Flag ZWJ sequences (🏳️‍🌈🏳️‍⚧️🏴‍☠️) use the normal path too.
 */
export function resolveEmojiSvgUrl(codepoints: string): string {
  const codePoints = parseCodepoints(codepoints);

  const regionCode = decodeRegionalIndicatorPair(codePoints) ?? decodeTagSequenceFlag(codePoints);
  if (regionCode) {
    return `${NOTO_EMOJI_CDN_BASE}/third_party/region-flags/svg/${regionCode}.svg`;
  }

  return `${NOTO_EMOJI_CDN_BASE}/2D/svg/emoji_u${codepoints}.svg`;
}

/**
 * Fetches emoji SVG markup from the Noto Emoji CDN mirror, served via
 * jsDelivr's GitHub proxy for googlefonts/noto-emoji.
 *
 * jsDelivr's `gh` endpoint pattern is `cdn.jsdelivr.net/gh/{user}/{repo}@{ref}/{path}`.
 * The ref is pinned to a release's commit; see `NOTO_EMOJI_CDN_BASE`.
 *
 * URL resolution (including flag routing) is delegated to
 * `resolveEmojiSvgUrl`.
 */
@Injectable({ providedIn: 'root' })
export class EmojiSourceService {
  /** Fetches SVG markup for the given Noto codepoint fragment (e.g. "1f600" or "1f468_200d_1f469_200d_1f467") as text. */
  async fetchEmoji(codepoints: string): Promise<string> {
    const url = resolveEmojiSvgUrl(codepoints);
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new Error(`Failed to fetch emoji ${codepoints}: network error (${String(error)})`, {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch emoji ${codepoints}: received ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  }

  /** Fetches the placeholder emoji (U+1F680 rocket) SVG markup as text. */
  fetchPlaceholderEmoji(): Promise<string> {
    return this.fetchEmoji(DEFAULT_EMOJI_CODEPOINTS);
  }
}
