import { Component, inject } from '@angular/core';
import { CanvasPreview, createDefaultLayers } from './canvas/canvas-preview';
import { FaviconExportService } from './export/favicon-export.service';

@Component({
  selector: 'app-root',
  imports: [CanvasPreview],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly exportService = inject(FaviconExportService);

  async downloadIco(): Promise<void> {
    const blob = await this.exportService.exportIco(createDefaultLayers());
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
