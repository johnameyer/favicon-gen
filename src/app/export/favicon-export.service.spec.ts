import { unzipSync } from 'fflate';
import { FaviconExportService } from './favicon-export.service';
import { buildPlaceholderLayers } from '../canvas/canvas-preview';

// jsdom does not implement CanvasRenderingContext2D drawing or toBlob, so we
// stub toBlob to hand back a small deterministic "PNG" (real pixel drawing is
// covered by the Playwright e2e suite in a real browser — see
// render-layers.spec.ts for the same caveat).
function stubCanvasToBlob(): void {
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback): void {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    callback(new Blob([bytes], { type: 'image/png' }));
  };
}

describe('FaviconExportService', () => {
  let service: FaviconExportService;
  const layers = buildPlaceholderLayers('<svg></svg>');

  beforeEach(() => {
    stubCanvasToBlob();
    service = new FaviconExportService();
  });

  describe('exportIco', () => {
    it('produces a non-empty ICO blob with the correct magic bytes', async () => {
      const blob = await service.exportIco(layers);
      expect(blob.size).toBeGreaterThan(0);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const view = new DataView(bytes.buffer);
      expect(view.getUint16(0, true)).toBe(0); // reserved
      expect(view.getUint16(2, true)).toBe(1); // type = icon
      expect(view.getUint16(4, true)).toBe(3); // 16/32/48 = 3 images
    });
  });

  describe('exportBundle', () => {
    it('zips all 7 expected files with non-empty contents', async () => {
      const blob = await service.exportBundle(layers);
      expect(blob.size).toBeGreaterThan(0);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const files = unzipSync(bytes);

      const expectedNames = [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'site.webmanifest',
        'snippet.html',
      ];
      expect(Object.keys(files).sort()).toEqual(expectedNames.sort());
      for (const name of expectedNames) {
        expect(files[name].byteLength).toBeGreaterThan(0);
      }
    });

    it('includes a valid site.webmanifest referencing both android-chrome icon sizes', async () => {
      const blob = await service.exportBundle(layers);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const files = unzipSync(bytes);

      const manifest = JSON.parse(new TextDecoder().decode(files['site.webmanifest']));
      expect(manifest.icons).toEqual([
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ]);
      expect(manifest.display).toBe('standalone');
    });

    it('includes a favicon.ico with valid ICO magic bytes', async () => {
      const blob = await service.exportBundle(layers);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const files = unzipSync(bytes);

      const view = new DataView(files['favicon.ico'].buffer, files['favicon.ico'].byteOffset);
      expect(view.getUint16(0, true)).toBe(0);
      expect(view.getUint16(2, true)).toBe(1);
    });

    it('includes a snippet.html with the expected link tags', async () => {
      const blob = await service.exportBundle(layers);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const files = unzipSync(bytes);

      const snippet = new TextDecoder().decode(files['snippet.html']);
      expect(snippet).toContain('href="/favicon.ico"');
      expect(snippet).toContain('href="/apple-touch-icon.png"');
      expect(snippet).toContain('href="/site.webmanifest"');
    });
  });
});
