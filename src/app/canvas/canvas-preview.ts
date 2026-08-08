import { AfterViewInit, Component, ElementRef, input, viewChild } from '@angular/core';
import { IDENTITY_TRANSFORM, Layer } from '../models/layer';
import { EMOJI_PLACEHOLDER_SVG } from './emoji-placeholder';
import { svgToDataUrl } from './svg-data-url';

/** Default seed layer stack: a single centered emoji, used until an editor exists. */
export function createDefaultLayers(): Layer[] {
  return [
    {
      id: 'placeholder-emoji',
      svgMarkup: EMOJI_PLACEHOLDER_SVG,
      transform: { ...IDENTITY_TRANSFORM },
    },
  ];
}

export const CANVAS_SIZE = 256;

@Component({
  selector: 'app-canvas-preview',
  template: `<canvas #canvas [width]="size" [height]="size" class="canvas-preview"></canvas>`,
  styleUrl: './canvas-preview.scss',
})
export class CanvasPreview implements AfterViewInit {
  readonly layers = input<Layer[]>(createDefaultLayers());
  readonly size = CANVAS_SIZE;

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  ngAfterViewInit(): void {
    void this.render();
  }

  /** Renders the full layer stack onto the canvas, bottom layer first. */
  async render(): Promise<void> {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const layer of this.layers()) {
      const image = await this.loadImage(svgToDataUrl(layer.svgMarkup));
      this.drawLayer(ctx, image, layer);
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load layer image: ${src.slice(0, 40)}...`));
      image.src = src;
    });
  }

  private drawLayer(ctx: CanvasRenderingContext2D, image: HTMLImageElement, layer: Layer): void {
    const { x, y, scale, rotation } = layer.transform;
    const size = this.size * scale;

    ctx.save();
    ctx.translate(this.size / 2 + x, this.size / 2 + y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}
