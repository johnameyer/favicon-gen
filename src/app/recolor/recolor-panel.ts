import { Component, effect, input, output, signal } from '@angular/core';
import { ColorGroup, extractColorGroups, groupExtractedColors, recolorGroup } from './color-utils';

/**
 * Lets the user recolor the current SVG by "color family": colors are
 * auto-grouped by hue (via `extractColorGroups` + `groupExtractedColors`), and picking a new color for
 * a group recolors every member together, preserving relative shading
 * (see `recolorGroup`).
 *
 * Auto-grouping is a suggestion, not final - the merge threshold can guess
 * wrong on adjacent-hue-but-different-material colors (e.g. body blue vs.
 * window glass teal). Two simple interactions let the user correct it:
 *  - "Split": ungroups a multi-color group back into one group per color.
 *  - Checkboxes + "Merge selected": combines 2+ selected groups into one.
 * Both were chosen over drag-and-drop as the simplest workable interaction
 * for a small number of groups (a handful of color families per SVG).
 */
@Component({
  selector: 'app-recolor-panel',
  template: `
    @if (groups().length > 0) {
      <div class="recolor-panel">
        <div class="recolor-panel-header">
          <span>Colors</span>
          <button type="button" class="recolor-panel-reset" (click)="reset()" data-testid="recolor-reset">
            Reset colors
          </button>
        </div>

        <ul class="recolor-panel-groups">
          @for (group of groups(); track group.id) {
            <li class="recolor-panel-group-wrapper">
              <div class="recolor-panel-group" data-testid="recolor-group">
                @if (group.colors.length > 1) {
                  <button
                    type="button"
                    class="recolor-panel-expand"
                    (click)="toggleExpanded(group.id)"
                    [attr.aria-expanded]="expandedGroups().has(group.id)"
                    data-testid="recolor-group-expand"
                  >
                    {{ expandedGroups().has(group.id) ? '▾' : '▸' }}
                  </button>
                }
                <input
                  type="checkbox"
                  class="recolor-panel-select"
                  [checked]="selectedForMerge().has(group.id)"
                  (change)="toggleSelected(group.id)"
                  [attr.aria-label]="'Select color group ' + group.colors[0] + ' for merge'"
                  data-testid="recolor-group-select"
                />
                <span
                  class="recolor-panel-swatch"
                  [style.background]="currentColorFor(group)"
                  data-testid="recolor-group-swatch"
                ></span>
                <input
                  type="color"
                  class="recolor-panel-picker"
                  [value]="currentColorFor(group)"
                  (input)="onColorPicked(group, $event)"
                  data-testid="recolor-group-picker"
                />
                <span class="recolor-panel-count">{{ group.colors.length }} shade{{ group.colors.length === 1 ? '' : 's' }}</span>
                @if (group.colors.length > 1) {
                  <button
                    type="button"
                    class="recolor-panel-split"
                    (click)="split(group)"
                    data-testid="recolor-group-split"
                  >
                    Split
                  </button>
                }
              </div>

              @if (expandedGroups().has(group.id)) {
                <ul class="recolor-panel-members">
                  @for (color of group.colors; track color) {
                    <li class="recolor-panel-member" data-testid="recolor-member">
                      <span
                        class="recolor-panel-swatch recolor-panel-swatch-small"
                        [style.background]="currentColorForMember(group, color)"
                        data-testid="recolor-member-swatch"
                      ></span>
                      <input
                        type="color"
                        class="recolor-panel-picker recolor-panel-picker-small"
                        [value]="currentColorForMember(group, color)"
                        (input)="onMemberColorPicked(color, $event)"
                        data-testid="recolor-member-picker"
                      />
                      <span class="recolor-panel-member-label">{{ color }}</span>
                      @if (memberOverrides()[color]) {
                        <button
                          type="button"
                          class="recolor-panel-member-clear"
                          (click)="clearMemberOverride(color)"
                          data-testid="recolor-member-clear"
                        >
                          &times;
                        </button>
                      }
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>

        <button
          type="button"
          class="recolor-panel-merge"
          [disabled]="selectedForMerge().size < 2"
          (click)="mergeSelected()"
          data-testid="recolor-merge"
        >
          Merge selected
        </button>
      </div>
    }
  `,
  styleUrl: './recolor-panel.scss',
})
export class RecolorPanel {
  /** SVG markup of the layer currently being recolored. */
  readonly svgMarkup = input<string | undefined>(undefined);

  /**
   * Emits the full {originalColor: newColor} override map whenever the
   * user's selections change. Only includes entries for groups where the
   * user actually picked a color (groups left at their suggested/original
   * color are omitted).
   */
  readonly colorsChanged = output<Record<string, string>>();

  readonly groups = signal<ColorGroup[]>([]);
  readonly selectedForMerge = signal<Set<string>>(new Set());
  readonly expandedGroups = signal<Set<string>>(new Set());

  /** Per-group user-picked replacement color, keyed by group id. Absent = "unchanged". */
  private readonly chosenColors = signal<Record<string, string>>({});

  /**
   * Per-original-color user override, keyed by original color hex. When
   * present, this wins over whatever the owning group's bulk `recolorGroup`
   * math would otherwise produce for that member - lets the user fine-tune
   * one shade without giving up the group-level "recolor everything at once"
   * convenience.
   */
  readonly memberOverrides = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const markup = this.svgMarkup();
      if (!markup) {
        this.groups.set([]);
        this.chosenColors.set({});
        this.selectedForMerge.set(new Set());
        this.expandedGroups.set(new Set());
        this.memberOverrides.set({});
        return;
      }
      const extracted = extractColorGroups(markup);
      this.groups.set(groupExtractedColors(extracted));
      this.chosenColors.set({});
      this.selectedForMerge.set(new Set());
      this.expandedGroups.set(new Set());
      this.memberOverrides.set({});
    });
  }

  /** The color currently shown for a group's swatch/picker: the user's pick, or its original dominant color. */
  currentColorFor(group: ColorGroup): string {
    return this.chosenColors()[group.id] ?? group.colors[0];
  }

  /**
   * The color currently shown for one individual member's swatch/picker:
   * its own override if set, else whatever the group-level bulk recolor
   * currently computes for it (or the original color if the group itself
   * has no chosen color).
   */
  currentColorForMember(group: ColorGroup, color: string): string {
    const override = this.memberOverrides()[color];
    if (override) {
      return override;
    }
    const groupPick = this.chosenColors()[group.id];
    if (!groupPick) {
      return color;
    }
    return recolorGroup(group, group.colors[0], groupPick)[color] ?? color;
  }

  onColorPicked(group: ColorGroup, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newColor = input.value.toUpperCase();
    this.chosenColors.update((current) => ({ ...current, [group.id]: newColor }));
    this.emitOverrides();
  }

  onMemberColorPicked(color: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newColor = input.value.toUpperCase();
    this.memberOverrides.update((current) => ({ ...current, [color]: newColor }));
    this.emitOverrides();
  }

  /** Clears one member's individual override, reverting it to the group-computed value. */
  clearMemberOverride(color: string): void {
    this.memberOverrides.update((current) => {
      const rest = { ...current };
      delete rest[color];
      return rest;
    });
    this.emitOverrides();
  }

  toggleExpanded(groupId: string): void {
    this.expandedGroups.update((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  /**
   * Ungroups a multi-color group back into one single-color group per
   * member. Individual member overrides are preserved - the color's
   * identity doesn't change, only which group it's nominally in.
   */
  split(group: ColorGroup): void {
    this.groups.update((groups) => {
      const index = groups.findIndex((g) => g.id === group.id);
      if (index === -1) {
        return groups;
      }
      const replacement = group.colors.map((color, i) => ({ id: `${group.id}-split-${i}`, colors: [color] }));
      return [...groups.slice(0, index), ...replacement, ...groups.slice(index + 1)];
    });
    this.chosenColors.update((current) => {
      const rest = { ...current };
      delete rest[group.id];
      return rest;
    });
    this.expandedGroups.update((current) => {
      const next = new Set(current);
      next.delete(group.id);
      return next;
    });
    this.emitOverrides();
  }

  toggleSelected(groupId: string): void {
    this.selectedForMerge.update((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  /** Merges all checked groups into a single group (colors concatenated, in group order). */
  mergeSelected(): void {
    const selectedIds = this.selectedForMerge();
    if (selectedIds.size < 2) {
      return;
    }
    this.groups.update((groups) => {
      const toMerge = groups.filter((g) => selectedIds.has(g.id));
      const rest = groups.filter((g) => !selectedIds.has(g.id));
      const firstIndex = groups.findIndex((g) => selectedIds.has(g.id));
      const merged: ColorGroup = {
        id: `merged-${toMerge.map((g) => g.id).join('-')}`,
        colors: toMerge.flatMap((g) => g.colors),
      };
      const restBeforeCount = groups.slice(0, firstIndex).filter((g) => !selectedIds.has(g.id)).length;
      const result = [...rest];
      result.splice(restBeforeCount, 0, merged);
      return result;
    });
    this.chosenColors.update((current) => {
      const next = { ...current };
      for (const id of selectedIds) {
        delete next[id];
      }
      return next;
    });
    this.selectedForMerge.set(new Set());
    this.emitOverrides();
  }

  /** Clears all user color picks (group-level and individual member overrides), reverting everything to original. */
  reset(): void {
    this.chosenColors.set({});
    this.memberOverrides.set({});
    this.emitOverrides();
  }

  private emitOverrides(): void {
    const overrides: Record<string, string> = {};
    const chosen = this.chosenColors();
    for (const group of this.groups()) {
      const picked = chosen[group.id];
      if (!picked) {
        continue;
      }
      Object.assign(overrides, recolorGroup(group, group.colors[0], picked));
    }
    // Individual member overrides win over whatever the group-level bulk
    // recolor computed for that specific original color.
    Object.assign(overrides, this.memberOverrides());
    this.colorsChanged.emit(overrides);
  }
}
