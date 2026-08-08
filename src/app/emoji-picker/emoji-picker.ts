import { Component, computed, output, signal } from '@angular/core';
import { EMOJI_CATALOG, EmojiCatalogEntry } from './emoji-catalog';

/** Payload emitted when the user selects an emoji from the picker. */
export interface EmojiSelection {
  emoji: string;
  codepoints: string;
  name: string;
}

/** Number of results shown when the search input is empty. */
const EMPTY_SEARCH_RESULT_LIMIT = 60;

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
              [title]="entry.name"
              [attr.aria-label]="entry.name"
              (click)="select(entry)"
            >
              <img
                [src]="thumbnailUrl(entry)"
                [alt]="entry.name"
                loading="lazy"
                class="emoji-picker-thumb"
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
      return EMOJI_CATALOG.slice(0, EMPTY_SEARCH_RESULT_LIMIT);
    }
    return EMOJI_CATALOG.filter(
      (entry) => entry.name.toLowerCase().includes(term) || entry.slug.toLowerCase().includes(term),
    );
  });

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  thumbnailUrl(entry: EmojiCatalogEntry): string {
    return `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u${entry.codepoints}.svg`;
  }

  select(entry: EmojiCatalogEntry): void {
    this.emojiSelected.emit({ emoji: entry.emoji, codepoints: entry.codepoints, name: entry.name });
  }
}
