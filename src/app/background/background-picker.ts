import { Component, computed, model } from '@angular/core';
import {
  BackgroundFill,
  BackgroundOptions,
  BackgroundShape,
  DEFAULT_BACKGROUND,
} from './background';

/** Shape, fill and size controls for the background shared by every source mode. */
@Component({
  selector: 'app-background-picker',
  template: `
    <div class="background-picker">
      <label class="background-picker-row">
        Shape
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
        @if (background().shape === 'rounded-square') {
          <label class="background-picker-row">
            Corner radius
            <span class="background-picker-slider">
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                [value]="background().cornerRadius"
                (input)="update({ cornerRadius: +$any($event.target).value })"
                data-testid="background-corner-radius"
              />
              <output>{{ background().cornerRadius }}%</output>
            </span>
          </label>
        }
        <label class="background-picker-row">
          Fill
          <select
            (change)="update({ fill: $any($event.target).value })"
            data-testid="background-fill"
          >
            @for (fill of fills; track fill.value) {
              <option [value]="fill.value" [selected]="background().fill === fill.value">
                {{ fill.label }}
              </option>
            }
          </select>
        </label>
        <label class="background-picker-row">
          {{ background().fill === 'solid' ? 'Color' : 'Start color' }}
          <input
            type="color"
            [value]="background().color"
            (input)="update({ color: $any($event.target).value.toUpperCase() })"
            data-testid="background-color"
          />
        </label>
        @if (background().fill !== 'solid') {
          <label class="background-picker-row">
            End color
            <input
              type="color"
              [value]="background().color2"
              (input)="update({ color2: $any($event.target).value.toUpperCase() })"
              data-testid="background-color2"
            />
          </label>
        }
        @if (background().fill === 'linear') {
          <label class="background-picker-row">
            Angle
            <span class="background-picker-slider">
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                [value]="background().angle"
                (input)="update({ angle: +$any($event.target).value })"
                data-testid="background-angle"
              />
              <output>{{ background().angle }}°</output>
            </span>
          </label>
        }
        <label class="background-picker-row">
          Content size
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

  readonly fills: { value: BackgroundFill; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'linear', label: 'Linear gradient' },
    { value: 'radial', label: 'Radial gradient' },
  ];

  /** Content size relative to the shape, as a whole percentage for the slider. */
  readonly percent = computed(() => Math.round(this.background().contentScale * 100));

  update(changes: Partial<BackgroundOptions>): void {
    this.background.update((current) => ({ ...current, ...changes }));
  }
}
