import emojiKeywords from 'emojilib/dist/emoji-en-US.json';
import { emojiToCodepoints } from '../canvas/emoji-source.service';

/** A single searchable/selectable entry in the emoji picker's catalog. */
export interface EmojiCatalogEntry {
  /** The emoji character itself (may be a multi-codepoint ZWJ sequence). */
  emoji: string;
  /**
   * Keyword list from `emojilib`, e.g. `["automobile", "red", "transportation",
   * "vehicle", "car", "side"]` for 🚗. The first keyword is typically the most
   * name-like/descriptive one and can be used as a display label.
   */
  keywords: string[];
  /** Noto codepoint filename fragment, e.g. "1f600". */
  codepoints: string;
}

/**
 * Flat, search-friendly list of emoji built from `emojilib`'s keyword data.
 * No emoji are excluded by group/category — flag emoji are included, with
 * URL resolution for their (differently-located) assets handled by
 * `EmojiSourceService`/`resolveEmojiSvgUrl`.
 */
export const EMOJI_CATALOG: EmojiCatalogEntry[] = Object.entries(
  emojiKeywords as Record<string, string[]>,
).map(([emoji, keywords]) => ({
  emoji,
  keywords,
  codepoints: emojiToCodepoints(emoji),
}));
