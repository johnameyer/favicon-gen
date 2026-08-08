import { AfterViewInit, Component, ElementRef, input, viewChild } from '@angular/core';
import { IDENTITY_TRANSFORM, Layer } from '../models/layer';
import { EMOJI_PLACEHOLDER_SVG } from './emoji-placeholder';
import { renderLayersToCanvas } from './render-layers';

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

    const rendered = await renderLayersToCanvas(this.layers(), this.size);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rendered, 0, 0);
  }
}
