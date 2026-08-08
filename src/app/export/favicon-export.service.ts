import { Injectable } from '@angular/core';
import { zipSync } from 'fflate';
import { Layer } from '../models/layer';
import { renderLayersToCanvas } from '../canvas/render-layers';
import { encodeIcoBuffer, IcoImageInput } from './ico-encoder';

/** Standard favicon.ico raster sizes, in ascending order. */
export const ICO_SIZES = [16, 32, 48] as const;

/** Standard web app manifest for the android-chrome icons bundled into the full export. */
function buildWebManifest(): string {
  return JSON.stringify(
    {
      name: 'My Site',
      short_name: 'My Site',
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    },
    null,
    2,
  );
}

/** Ready-to-paste <head> markup for the favicon set produced by exportBundle. */
const HEAD_SNIPPET = `<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
`;

@Injectable({ providedIn: 'root' })
export class FaviconExportService {
  /** Renders the layer stack at the standard ICO sizes and encodes a favicon.ico Blob. */
  async exportIco(layers: Layer[]): Promise<Blob> {
    const icoBytes = await this.renderIcoBytes(layers);
    return new Blob([icoBytes.slice().buffer as ArrayBuffer], { type: 'image/x-icon' });
  }

  /**
   * Renders the full favicon bundle (favicon.ico, individual PNGs at the
   * common sizes, a web app manifest, and a ready-to-paste <head> snippet)
   * and zips them into a single downloadable Blob.
   */
  async exportBundle(layers: Layer[]): Promise<Blob> {
    const [icoBytes, png16, png32, appleTouch, android192, android512] = await Promise.all([
      this.renderIcoBytes(layers),
      this.renderPngBytes(layers, 16),
      this.renderPngBytes(layers, 32),
      this.renderPngBytes(layers, 180),
      this.renderPngBytes(layers, 192),
      this.renderPngBytes(layers, 512),
    ]);

    const files: Record<string, Uint8Array> = {
      'favicon.ico': icoBytes,
      'favicon-16x16.png': png16,
      'favicon-32x32.png': png32,
      'apple-touch-icon.png': appleTouch,
      'android-chrome-192x192.png': android192,
      'android-chrome-512x512.png': android512,
      'site.webmanifest': new TextEncoder().encode(buildWebManifest()),
      'snippet.html': new TextEncoder().encode(HEAD_SNIPPET),
    };

    const zipped = zipSync(files);
    return new Blob([zipped.slice().buffer as ArrayBuffer], { type: 'application/zip' });
  }

  private async renderPngBytes(layers: Layer[], size: number): Promise<Uint8Array> {
    const canvas = await renderLayersToCanvas(layers, size);
    return canvasToPngBytes(canvas);
  }

  private async renderIcoBytes(layers: Layer[]): Promise<Uint8Array> {
    const pngs: IcoImageInput[] = [];
    for (const size of ICO_SIZES) {
      const data = await this.renderPngBytes(layers, size);
      pngs.push({ size, data });
    }
    return encodeIcoBuffer(pngs);
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
