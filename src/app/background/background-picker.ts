import { Component, computed, model } from '@angular/core';
import { BackgroundOptions, BackgroundShape, DEFAULT_BACKGROUND } from './background';

/** Shape + color controls for the background shared by every source mode. */
@Component({
  selector: 'app-background-picker',
  template: `
    <div class="background-picker">
      <label class="background-picker-row">
        Background
        <select
          (change)="update({ shape: $any($event.target).value })"
          data-testid="background-shape"
        >
          @for (shape of shapes; track shape.value) {
            <option [value]="shape.value" [selected]="background().shape === shape.value">
              {{ shape.label }}
            </option>
          }
        </select>
      </label>
      @if (background().shape !== 'none') {
        <label class="background-picker-row">
          Background color
          <input
            type="color"
            [value]="background().color"
            (input)="update({ color: $any($event.target).value.toUpperCase() })"
            data-testid="background-color"
          />
        </label>
        <label class="background-picker-row">
          Size
          <span class="background-picker-slider">
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              [value]="percent()"
              (input)="update({ contentScale: +$any($event.target).value / 100 })"
              data-testid="background-content-size"
            />
            <output>{{ percent() }}%</output>
          </span>
        </label>
      }
    </div>
  `,
  styleUrl: './background-picker.scss',
})
export class BackgroundPicker {
  readonly background = model<BackgroundOptions>(DEFAULT_BACKGROUND);

  readonly shapes: { value: BackgroundShape; label: string }[] = [
    { value: 'none', label: 'None (transparent)' },
    { value: 'rounded-square', label: 'Rounded square' },
    { value: 'circle', label: 'Circle' },
  ];

  /** Content size relative to the shape, as a whole percentage for the slider. */
  readonly percent = computed(() => Math.round(this.background().contentScale * 100));

  update(changes: Partial<BackgroundOptions>): void {
    this.background.update((current) => ({ ...current, ...changes }));
  }
}
