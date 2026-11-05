import { Component, OnInit, computed, output, signal } from '@angular/core';
import {
  CustomFont,
  DEFAULT_LETTER_OPTIONS,
  LetterFont,
  LetterOptions,
  buildLetterSvg,
  buildMeasureSvg,
  firstGrapheme,
} from './letter-svg';
import { loadFont } from './font-loader';
import { FontAxis, axisLabel } from './font-axes';
import { assertLoadableFont, measureGlyph } from './glyph-metrics';

/**
 * Custom font prefilled (and loaded) when "Custom URL…" is first chosen:
 * Roboto Flex with all 13 of its axes, including the parametric ones.
 * Google Fonts only makes an axis adjustable if the URL lists it with a
 * range; omitted axes are pinned at their defaults.
 */
export const DEFAULT_CUSTOM_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Roboto+Flex:' +
  'opsz,slnt,wdth,wght,GRAD,XOPQ,XTRA,YOPQ,YTAS,YTDE,YTFI,YTLC,YTUC@' +
  '8..144,-10..0,25..151,100..1000,-200..150,27..175,323..603,25..135,649..854,-305..-98,560..788,416..570,528..760';

@Component({
  selector: 'app-letter-input',
  template: `
    <div class="letter-input">
      <label class="letter-input-row">
        Letter
        <input
          type="text"
          class="letter-input-text"
          [value]="options().letter"
          (input)="onLetterInput($event)"
          aria-label="Letter"
          data-testid="letter-input"
        />
      </label>
      <label class="letter-input-row">
        Font
        <select (change)="update({ font: $any($event.target).value })" data-testid="letter-font">
          @for (font of fonts; track font.value) {
            <option [value]="font.value" [selected]="options().font === font.value">
              {{ font.label }}
            </option>
          }
        </select>
      </label>
      @if (options().font === 'custom') {
        <form
          class="letter-input-row"
          (submit)="$event.preventDefault(); loadCustomFont(fontUrl.value)"
        >
          <input
            #fontUrl
            type="url"
            class="letter-input-url"
            placeholder="Font file or Google Fonts CSS URL"
            [value]="options().customFontUrl"
            aria-label="Font URL"
            data-testid="letter-font-url"
          />
          <button type="submit" [disabled]="fontLoading()" data-testid="letter-font-load">
            Load
          </button>
        </form>
        <p class="letter-input-hint">
          For a variable Google Font, list the axes to adjust, e.g.
          <code>family=Roboto+Flex:wdth,wght&#64;25..151,100..1000</code>
        </p>
        @if (fontLoading()) {
          <p class="letter-input-status" data-testid="letter-font-loading">Loading font…</p>
        }
        @if (fontError()) {
          <p class="letter-input-error" data-testid="letter-font-error">{{ fontError() }}</p>
        }
      }
      @if (!weightAxis()) {
        <label class="letter-input-row">
          Weight
          <span class="letter-input-slider">
            <input
              type="range"
              min="100"
              max="900"
              step="100"
              [value]="options().weight"
              (input)="update({ weight: +$any($event.target).value })"
              data-testid="letter-weight"
            />
            <output>{{ options().weight }}</output>
          </span>
        </label>
      }
      <label class="letter-input-row">
        Italic
        <input
          type="checkbox"
          [checked]="options().italic"
          (change)="update({ italic: $any($event.target).checked })"
          data-testid="letter-italic"
        />
      </label>
      @for (axis of activeAxes(); track axis.tag) {
        <label class="letter-input-row" [title]="axis.tag">
          {{ label(axis) }}
          <span class="letter-input-slider">
            <input
              type="range"
              [min]="axis.min"
              [max]="axis.max"
              [step]="axisStep(axis)"
              [value]="axisValue(axis)"
              (input)="setAxis(axis.tag, +$any($event.target).value)"
              [attr.data-testid]="'letter-axis-' + axis.tag"
            />
            <output>{{ axisValue(axis) }}</output>
          </span>
        </label>
      }
      <label class="letter-input-row">
        Letter color
        <input
          type="color"
          [value]="options().color"
          (input)="update({ color: $any($event.target).value.toUpperCase() })"
          data-testid="letter-color"
        />
      </label>
    </div>
  `,
  styleUrl: './letter-input.scss',
})
export class LetterInput implements OnInit {
  /** Emits generated SVG markup on init (from the defaults) and on every option change. */
  readonly svgGenerated = output<string>();

  readonly options = signal<LetterOptions>({
    ...DEFAULT_LETTER_OPTIONS,
    customFontUrl: DEFAULT_CUSTOM_FONT_URL,
  });

  /** The loaded custom font, if any. */
  readonly customFont = signal<CustomFont | undefined>(undefined);
  readonly fontLoading = signal(false);
  readonly fontError = signal<string | undefined>(undefined);

  /** Variation axes to show sliders for: the custom font's, while it's selected. */
  readonly activeAxes = computed(() =>
    this.options().font === 'custom' ? (this.customFont()?.axes ?? []) : [],
  );

  /** A `wght` axis replaces the generic 100-900 weight slider. */
  readonly weightAxis = computed(() => this.activeAxes().find((axis) => axis.tag === 'wght'));

  readonly fonts: { value: LetterFont; label: string }[] = [
    { value: 'sans-serif', label: 'Sans-serif' },
    { value: 'serif', label: 'Serif' },
    { value: 'monospace', label: 'Monospace' },
    { value: 'custom', label: 'Custom URL…' },
  ];

  /** Guards against an older, slower font fetch overwriting a newer one. */
  private fontRequestId = 0;
  /** Guards against an older, slower glyph measurement emitting after a newer one. */
  private emitRequestId = 0;

  ngOnInit(): void {
    void this.emit();
  }

  label(axis: FontAxis): string {
    return axis.tag === 'wght' ? 'Weight' : axisLabel(axis.tag);
  }

  axisValue(axis: FontAxis): number {
    return this.options().axes[axis.tag] ?? axis.default;
  }

  /** Whole steps for wide axes (weight, width, ...), finer ones for narrow ones like `ital`. */
  axisStep(axis: FontAxis): number {
    return axis.max - axis.min > 10 ? 1 : 0.1;
  }

  setAxis(tag: string, value: number): Promise<void> {
    return this.update({ axes: { ...this.options().axes, [tag]: value } });
  }

  /**
   * Keeps the field to a single character. Typing next to the existing
   * letter keeps the new character rather than the old one, so there's no
   * need to delete first. An empty field is left alone (rather than
   * emitting a blank favicon) so the preview keeps the last letter while
   * the user is mid-edit.
   */
  onLetterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const previous = this.options().letter;
    const typed =
      input.value.startsWith(previous) && input.value.length > previous.length
        ? input.value.slice(previous.length)
        : input.value;
    const letter = firstGrapheme(typed);
    input.value = letter;
    if (letter) {
      void this.update({ letter });
      // Stylesheets like Google Fonts' are split into per-script files, so a
      // new letter may need a different file than the one already loaded.
      if (this.options().font === 'custom' && this.customFont()) {
        void this.loadCustomFont(this.options().customFontUrl);
      }
    }
  }

  update(changes: Partial<LetterOptions>): Promise<void> {
    this.options.update((current) => ({ ...current, ...changes }));
    // Choosing "Custom URL…" for the first time loads the prefilled font
    // (Roboto Flex); until then the letter falls back to sans-serif.
    if (changes.font === 'custom' && !this.customFont() && !this.fontLoading()) {
      void this.loadCustomFont(this.options().customFontUrl);
    }
    return this.emit();
  }

  /**
   * Fetches and embeds the font at `url`. On failure the previously loaded
   * font (or the sans-serif fallback) stays in use and an error is shown.
   */
  async loadCustomFont(url: string): Promise<void> {
    const requestId = ++this.fontRequestId;
    this.options.update((current) => ({ ...current, customFontUrl: url.trim() }));
    this.fontLoading.set(true);
    this.fontError.set(undefined);
    try {
      const font = await loadFont(url.trim(), this.options().letter);
      await assertLoadableFont(font.normal);
      if (requestId === this.fontRequestId) {
        this.customFont.set(font);
        this.options.update((current) => ({ ...current, axes: this.initialAxes(font, current) }));
        await this.emit();
      }
    } catch (error) {
      if (requestId === this.fontRequestId) {
        this.fontError.set(error instanceof Error ? error.message : "Couldn't load that font.");
      }
    } finally {
      if (requestId === this.fontRequestId) {
        this.fontLoading.set(false);
      }
    }
  }

  /**
   * Axis values for a newly loaded font: values already chosen for axes it
   * shares with the previous font are kept (e.g. reloading for a different
   * letter), and a new `wght` axis starts at the current weight so the
   * letter doesn't suddenly change weight. Everything else starts at the
   * font's own default.
   */
  private initialAxes(font: CustomFont, current: LetterOptions): Record<string, number> {
    const clamp = (axis: FontAxis, value: number) => Math.min(axis.max, Math.max(axis.min, value));
    return Object.fromEntries(
      font.axes.map((axis) => {
        const kept = current.axes[axis.tag];
        const initial = kept ?? (axis.tag === 'wght' ? current.weight : axis.default);
        return [axis.tag, clamp(axis, initial)];
      }),
    );
  }

  /** Measures the letter as it'll be drawn, then emits it centered on its actual ink. */
  private async emit(): Promise<void> {
    const requestId = ++this.emitRequestId;
    const options = this.options();
    const font = this.customFont();
    const glyph = await measureGlyph(buildMeasureSvg(options, font));
    if (requestId === this.emitRequestId) {
      this.svgGenerated.emit(buildLetterSvg(options, font, glyph));
    }
  }
}
