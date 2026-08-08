import { Injectable } from '@angular/core';
import { Layer } from '../models/layer';
import { renderLayersToCanvas } from '../canvas/render-layers';
import { encodeIco, IcoImageInput } from './ico-encoder';

/** Standard favicon.ico raster sizes, in ascending order. */
export const ICO_SIZES = [16, 32, 48] as const;

@Injectable({ providedIn: 'root' })
export class FaviconExportService {
  /** Renders the layer stack at the standard ICO sizes and encodes a favicon.ico Blob. */
  async exportIco(layers: Layer[]): Promise<Blob> {
    const pngs: IcoImageInput[] = [];

    for (const size of ICO_SIZES) {
      const canvas = await renderLayersToCanvas(layers, size);
      const data = await canvasToPngBytes(canvas);
      pngs.push({ size, data });
    }

    return encodeIco(pngs);
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to encode canvas as PNG'));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, 'image/png');
  });
}
