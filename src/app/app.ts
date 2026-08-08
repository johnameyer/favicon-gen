import { Component, inject, signal } from '@angular/core';
import { CanvasPreview, buildPlaceholderLayers } from './canvas/canvas-preview';
import { EmojiSourceService } from './canvas/emoji-source.service';
import { EmojiPicker, EmojiSelection } from './emoji-picker/emoji-picker';
import { SvgUpload } from './svg-upload/svg-upload';
import { Layer } from './models/layer';
import { FaviconExportService } from './export/favicon-export.service';

/** Which source tab is currently active/being used to feed the canvas. */
export type SourceTab = 'emoji' | 'upload';

@Component({
  selector: 'app-root',
  imports: [CanvasPreview, EmojiPicker, SvgUpload],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly exportService = inject(FaviconExportService);
  private readonly emojiSource = inject(EmojiSourceService);

  /** Which source tab (emoji picker vs. custom SVG upload) is active. */
  readonly activeTab = signal<SourceTab>('emoji');

  /** Latest layer stack resolved by the preview (explicit input or fetched placeholder). */
  readonly currentLayers = signal<Layer[] | undefined>(undefined);

  /**
   * Explicit layer stack to pass into CanvasPreview once the user has picked
   * an emoji or uploaded a file. Undefined means "use CanvasPreview's own
   * default placeholder".
   */
  readonly selectedLayers = signal<Layer[] | undefined>(undefined);

  /** True while fetching the SVG for a picker-driven selection. */
  readonly selectionLoading = signal(false);

  onLayersResolved(layers: Layer[]): void {
    this.currentLayers.set(layers);
  }

  setActiveTab(tab: SourceTab): void {
    this.activeTab.set(tab);
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
    try {
      const svgMarkup = await this.emojiSource.fetchEmoji(selection.codepoints);
      this.loadSvgAsCurrentSource(svgMarkup);
    } catch (error) {
      // Keep showing whatever was previously selected; just report the failure.
      console.error(`Failed to load emoji "${selection.name}":`, error);
    } finally {
      this.selectionLoading.set(false);
    }
  }

  onSvgUploaded(svgMarkup: string): void {
    this.loadSvgAsCurrentSource(svgMarkup);
  }

  async downloadIco(): Promise<void> {
    const layers = this.currentLayers();
    if (!layers) {
      return;
    }
    const blob = await this.exportService.exportIco(layers);
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'favicon.ico';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
