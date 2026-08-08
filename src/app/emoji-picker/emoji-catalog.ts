import emojiData from 'unicode-emoji-json/data-by-emoji.json';
import { emojiToCodepoints } from '../canvas/emoji-source.service';

/** A single searchable/selectable entry in the emoji picker's catalog. */
export interface EmojiCatalogEntry {
  /** The emoji character itself (may be a multi-codepoint ZWJ sequence). */
  emoji: string;
  /** Human-readable name, e.g. "grinning face". */
  name: string;
  /** Slug form of the name, e.g. "grinning_face". */
  slug: string;
  /** Unicode emoji group, e.g. "Smileys & Emotion". */
  group: string;
  /** Noto codepoint filename fragment, e.g. "1f600". */
  codepoints: string;
}

/**
 * Unicode group excluded from the catalog: flag emoji (regional indicator
 * pairs) are not stored under Noto's codepoint-filename convention (they
 * live under `third_party/region-flags` with different naming), so fetching
 * them via `EmojiSourceService.fetchEmoji` would 404. See
 * `emoji-source.service.ts` for details.
 */
const EXCLUDED_GROUP = 'Flags';

interface RawEmojiEntry {
  name: string;
  slug: string;
  group: string;
  emoji_version: string;
  unicode_version: string;
  skin_tone_support: boolean;
}

/**
 * Flat, search-friendly list of emoji built from `unicode-emoji-json`,
 * excluding the Flags group (see `EXCLUDED_GROUP`).
 */
export const EMOJI_CATALOG: EmojiCatalogEntry[] = Object.entries(
  emojiData as Record<string, RawEmojiEntry>,
)
  .filter(([, data]) => data.group !== EXCLUDED_GROUP)
  .map(([emoji, data]) => ({
    emoji,
    name: data.name,
    slug: data.slug,
    group: data.group,
    codepoints: emojiToCodepoints(emoji),
  }));
