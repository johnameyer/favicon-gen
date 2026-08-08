import { Injectable } from '@angular/core';

/**
 * CDN URL for the placeholder emoji (Noto "grinning face", U+1F600), served
 * as raw SVG via jsDelivr's GitHub proxy for googlefonts/noto-emoji.
 *
 * jsDelivr's `gh` endpoint pattern is `cdn.jsdelivr.net/gh/{user}/{repo}@{ref}/{path}`.
 * The `@main` branch ref works fine for this repo/path (verified: returns
 * `200` with `content-type: image/svg+xml`), so there was no need to pin to
 * a commit SHA or release tag.
 */
const EMOJI_PLACEHOLDER_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f600.svg';

/**
 * Fetches emoji SVG markup from the Noto Emoji CDN mirror.
 *
 * Scoped narrowly to the single hardcoded placeholder emoji for now; a later
 * step will generalize this to arbitrary codepoints once a picker UI exists.
 */
@Injectable({ providedIn: 'root' })
export class EmojiSourceService {
  /** Fetches the placeholder emoji (U+1F600) SVG markup as text. */
  async fetchPlaceholderEmoji(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(EMOJI_PLACEHOLDER_URL);
    } catch (error) {
      throw new Error(`Failed to fetch placeholder emoji: network error (${String(error)})`, {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch placeholder emoji: received ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  }
}
