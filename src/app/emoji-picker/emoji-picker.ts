import { Component, computed, output, signal } from '@angular/core';
import { resolveEmojiSvgUrl } from '../canvas/emoji-source.service';
import { EMOJI_CATALOG, EmojiCatalogEntry } from './emoji-catalog';

/** Payload emitted when the user selects an emoji from the picker. */
export interface EmojiSelection {
  emoji: string;
  codepoints: string;
  name: string;
}

/** Number of results shown when the search input is empty. */
const EMPTY_SEARCH_RESULT_LIMIT = 60;

/**
 * Default results shown before the user types anything. `EMOJI_CATALOG` is
 * ordered by emojilib's underlying Unicode grouping, which starts with
 * Smileys & Emotion - taking a plain slice(0, N) would show nothing but
 * faces. Sampling at a fixed stride across the whole catalog instead gives
 * a representative spread (objects, animals, food, etc.) without needing
 * any category metadata (which the catalog doesn't have) or hand-curation.
 */
function buildDefaultResults(): EmojiCatalogEntry[] {
  const stride = Math.max(1, Math.floor(EMOJI_CATALOG.length / EMPTY_SEARCH_RESULT_LIMIT));
  const result: EmojiCatalogEntry[] = [];
  for (let i = 0; i < EMOJI_CATALOG.length && result.length < EMPTY_SEARCH_RESULT_LIMIT; i += stride) {
    result.push(EMOJI_CATALOG[i]);
  }
  return result;
}

const DEFAULT_RESULTS = buildDefaultResults();

@Component({
  selector: 'app-emoji-picker',
  template: `
    <div class="emoji-picker">
      <input
        type="text"
        class="emoji-picker-search"
        placeholder="Search emoji…"
        [value]="query()"
        (input)="onQueryInput($event)"
        data-testid="emoji-picker-search"
      />
      @if (results().length === 0) {
        <p class="emoji-picker-empty" data-testid="emoji-picker-no-results">No emoji found</p>
      } @else {
        <div class="emoji-picker-grid" data-testid="emoji-picker-grid">
          @for (entry of results(); track entry.emoji) {
            <button
              type="button"
              class="emoji-picker-item"
              [title]="entryLabel(entry)"
              [attr.aria-label]="entryLabel(entry)"
              (click)="select(entry)"
            >
              <img
                [src]="thumbnailUrl(entry)"
                [alt]="entryLabel(entry)"
                loading="lazy"
                class="emoji-picker-thumb"
                (error)="onThumbnailError($event)"
              />
            </button>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './emoji-picker.scss',
})
export class EmojiPicker {
  readonly query = signal('');

  /** Emits when the user selects an emoji from the results grid. */
  readonly emojiSelected = output<EmojiSelection>();

  readonly results = computed<EmojiCatalogEntry[]>(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) {
      return DEFAULT_RESULTS;
    }
    return EMOJI_CATALOG.filter((entry) =>
      entry.keywords.some((keyword) => keyword.toLowerCase().includes(term)),
    );
  });

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Human-readable label for an entry, derived from its first (most name-like) keyword. */
  entryLabel(entry: EmojiCatalogEntry): string {
    return (entry.keywords[0] ?? entry.emoji).replace(/_/g, ' ');
  }

  thumbnailUrl(entry: EmojiCatalogEntry): string {
    return resolveEmojiSvgUrl(entry.codepoints);
  }

  /** Hides a thumbnail image that failed to load (e.g. an emoji with no resolvable asset). */
  onThumbnailError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('emoji-picker-thumb--broken');
  }

  select(entry: EmojiCatalogEntry): void {
    this.emojiSelected.emit({
      emoji: entry.emoji,
      codepoints: entry.codepoints,
      name: this.entryLabel(entry),
    });
  }
}
