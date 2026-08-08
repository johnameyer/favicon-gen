import { Injectable } from '@angular/core';

/**
 * Default placeholder emoji codepoint fragment (Noto "grinning face", U+1F600).
 */
const DEFAULT_EMOJI_CODEPOINTS = '1f600';

/**
 * Converts an emoji character (which may be a multi-codepoint ZWJ sequence,
 * e.g. family emoji) into the codepoint filename fragment Noto Emoji uses,
 * e.g. "1f468_200d_1f469_200d_1f467".
 *
 * `Array.from` iterates by Unicode code point (not UTF-16 code unit), so
 * surrogate pairs are handled correctly. Variation selector-16 (U+FE0F) is
 * filtered out because Noto's filenames omit it.
 */
export function emojiToCodepoints(emoji: string): string {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0)!)
    .filter((codePoint) => codePoint !== 0xfe0f)
    .map((codePoint) => codePoint.toString(16).toLowerCase())
    .join('_');
}

/** Builds the jsDelivr GitHub-proxy CDN URL for a Noto Emoji codepoint fragment. */
function emojiCdnUrl(codepoints: string): string {
  return `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u${codepoints}.svg`;
}

/**
 * Fetches emoji SVG markup from the Noto Emoji CDN mirror, served via
 * jsDelivr's GitHub proxy for googlefonts/noto-emoji.
 *
 * jsDelivr's `gh` endpoint pattern is `cdn.jsdelivr.net/gh/{user}/{repo}@{ref}/{path}`.
 * The `@main` branch ref works fine for this repo/path (verified: returns
 * `200` with `content-type: image/svg+xml`), so there was no need to pin to
 * a commit SHA or release tag.
 *
 * Known limitation: flag emoji (regional indicator pairs) are NOT stored
 * under this codepoint-filename convention in noto-emoji — they live under
 * `third_party/region-flags` with different naming — so fetching them via
 * this scheme 404s. Callers should exclude the "Flags" group.
 */
@Injectable({ providedIn: 'root' })
export class EmojiSourceService {
  /** Fetches SVG markup for the given Noto codepoint fragment (e.g. "1f600" or "1f468_200d_1f469_200d_1f467") as text. */
  async fetchEmoji(codepoints: string): Promise<string> {
    const url = emojiCdnUrl(codepoints);
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

  /** Fetches the placeholder emoji (U+1F600) SVG markup as text. */
  fetchPlaceholderEmoji(): Promise<string> {
    return this.fetchEmoji(DEFAULT_EMOJI_CODEPOINTS);
  }
}
