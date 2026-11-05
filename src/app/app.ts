import { Component, computed, inject, signal } from '@angular/core';
import { CanvasPreview, buildPlaceholderLayers } from './canvas/canvas-preview';
import { EmojiSourceService } from './canvas/emoji-source.service';
import { EmojiPicker, EmojiSelection } from './emoji-picker/emoji-picker';
import { SvgUpload } from './svg-upload/svg-upload';
import { Layer } from './models/layer';
import { FaviconExportService } from './export/favicon-export.service';
import { RecolorPanel } from './recolor/recolor-panel';
import { BackgroundPicker } from './background/background-picker';
import { BackgroundOptions, DEFAULT_BACKGROUND, withBackground } from './background/background';

/** Which source tab is currently active/being used to feed the canvas. */
export type SourceTab = 'emoji' | 'upload';

/** Which export mode is selected for the download button. */
export type ExportMode = 'ico' | 'bundle';

@Component({
  selector: 'app-root',
  imports: [CanvasPreview, EmojiPicker, SvgUpload, RecolorPanel, BackgroundPicker],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly exportService = inject(FaviconExportService);
  private readonly emojiSource = inject(EmojiSourceService);

  /** Which source tab (emoji picker vs. custom SVG upload) is active. */
  readonly activeTab = signal<SourceTab>('emoji');

  /**
   * The content layer stack from the active source (emoji, upload, or the
   * preview's fetched placeholder), without the shared background.
   * Undefined until the placeholder resolves; CanvasPreview fetches it
   * itself while no layers are passed in.
   */
  readonly selectedLayers = signal<Layer[] | undefined>(undefined);

  /** Background shape shared by every source mode. */
  readonly background = signal<BackgroundOptions>(DEFAULT_BACKGROUND);

  /** What's actually previewed and exported: the content plus the shared background. */
  readonly outputLayers = computed(() => {
    const content = this.selectedLayers();
    return content && withBackground(content, this.background());
  });

  /** True while fetching the SVG for a picker-driven selection. */
  readonly selectionLoading = signal(false);

  /** User-visible message when a picker-driven emoji selection fails to load. */
  readonly selectionError = signal<string | undefined>(undefined);

  /** Which export mode the download button uses: ICO-only or the full zip bundle. */
  readonly exportMode = signal<ExportMode>('bundle');

  /**
   * Adopts the preview's fetched placeholder as the content, so it gets the
   * shared background too. Ignored once a source has supplied layers, since
   * the preview then just echoes back the composed `outputLayers`.
   */
  onLayersResolved(layers: Layer[]): void {
    if (!this.selectedLayers()) {
      this.selectedLayers.set(layers);
    }
  }

  setActiveTab(tab: SourceTab): void {
    this.activeTab.set(tab);
  }

  /**
   * Applies a recolor override map to the current (single) layer and pushes
   * the updated stack back into `selectedLayers`, so `CanvasPreview`'s
   * existing `layers` input reactivity re-renders with the new colors.
   */
  onColorsChanged(colorOverrides: Record<string, string>): void {
    const layers = this.selectedLayers();
    if (!layers || layers.length === 0) {
      return;
    }
    const [layer, ...rest] = layers;
    const updated: Layer[] = [{ ...layer, colorOverrides }, ...rest];
    this.selectedLayers.set(updated);
  }

  /**
   * Shared "load this SVG markup as the current source" path, used by both
   * the emoji picker (once its fetch resolves) and the SVG upload component.
   */
  loadSvgAsCurrentSource(svgMarkup: string): void {
    this.selectedLayers.set(buildPlaceholderLayers(svgMarkup));
  }

  async onEmojiSelected(selection: EmojiSelection): Promise<void> {
    this.selectionLoading.set(true);
    this.selectionError.set(undefined);
    try {
      const svgMarkup = await this.emojiSource.fetchEmoji(selection.codepoints);
      this.loadSvgAsCurrentSource(svgMarkup);
    } catch (error) {
      // Keep showing whatever was previously selected; just report the failure.
      console.error(`Failed to load emoji "${selection.name}":`, error);
      this.selectionError.set(`Couldn't load "${selection.name}". Please try a different emoji.`);
    } finally {
      this.selectionLoading.set(false);
    }
  }

  onSvgUploaded(svgMarkup: string): void {
    this.loadSvgAsCurrentSource(svgMarkup);
  }

  setExportMode(mode: ExportMode): void {
    this.exportMode.set(mode);
  }

  async download(): Promise<void> {
    const layers = this.outputLayers();
    if (!layers) {
      return;
    }
    const mode = this.exportMode();
    const blob =
      mode === 'ico'
        ? await this.exportService.exportIco(layers)
        : await this.exportService.exportBundle(layers);
    const filename = mode === 'ico' ? 'favicon.ico' : 'favicon-package.zip';

    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
