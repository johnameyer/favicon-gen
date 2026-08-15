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

/** Max additional synonyms shown in the hover popover, beyond the primary name. */
const POPOVER_SYNONYM_LIMIT = 5;

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
              [attr.aria-label]="entryLabel(entry)"
              (click)="select(entry)"
              (mouseenter)="onHoverStart(entry, $event)"
              (mouseleave)="onHoverEnd()"
              (focus)="onHoverStart(entry, $event)"
              (blur)="onHoverEnd()"
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
    @if (hoveredEntry(); as entry) {
      @if (popoverPosition(); as position) {
        <span
          class="emoji-picker-popover"
          role="tooltip"
          data-testid="emoji-picker-popover"
          [style.top.px]="position.top"
          [style.left.px]="position.left"
        >
          <span class="emoji-picker-popover-name">{{ entryLabel(entry) }}</span>
          @if (entrySynonyms(entry); as synonyms) {
            <span class="emoji-picker-popover-synonyms">{{ synonyms }}</span>
          }
        </span>
      }
    }
  `,
  styleUrl: './emoji-picker.scss',
})
export class EmojiPicker {
  readonly query = signal('');

  /** Emits when the user selects an emoji from the results grid. */
  readonly emojiSelected = output<EmojiSelection>();

  /**
   * The entry currently hovered/focused, and the popover's fixed-position
   * coordinates. Rendered as a single element outside the scrolling grid
   * (rather than a per-item CSS-only tooltip) because `position: fixed`
   * escapes the grid's `overflow-y: auto` clipping - a tooltip nested
   * inside a scrolling ancestor can't otherwise render outside its bounds.
   */
  readonly hoveredEntry = signal<EmojiCatalogEntry | null>(null);
  readonly popoverPosition = signal<{ top: number; left: number } | null>(null);

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

  /** Remaining search synonyms for the hover popover, beyond the primary name, or null if none. */
  entrySynonyms(entry: EmojiCatalogEntry): string | null {
    const rest = entry.keywords.slice(1, 1 + POPOVER_SYNONYM_LIMIT).map((keyword) => keyword.replace(/_/g, ' '));
    return rest.length > 0 ? rest.join(', ') : null;
  }

  onHoverStart(entry: EmojiCatalogEntry, event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.hoveredEntry.set(entry);
    this.popoverPosition.set({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  }

  onHoverEnd(): void {
    this.hoveredEntry.set(null);
    this.popoverPosition.set(null);
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
