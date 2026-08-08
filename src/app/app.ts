import { Component, inject, signal } from '@angular/core';
import { CanvasPreview } from './canvas/canvas-preview';
import { Layer } from './models/layer';
import { FaviconExportService } from './export/favicon-export.service';

@Component({
  selector: 'app-root',
  imports: [CanvasPreview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly exportService = inject(FaviconExportService);

  /** Latest layer stack resolved by the preview (explicit input or fetched placeholder). */
  readonly currentLayers = signal<Layer[] | undefined>(undefined);

  onLayersResolved(layers: Layer[]): void {
    this.currentLayers.set(layers);
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
