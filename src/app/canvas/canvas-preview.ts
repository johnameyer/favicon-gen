import {
  AfterViewInit,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IDENTITY_TRANSFORM, Layer } from '../models/layer';
import { EmojiSourceService } from './emoji-source.service';
import { renderLayersToCanvas } from './render-layers';

/** Wraps fetched emoji SVG markup in the single-layer stack shape the canvas expects. */
export function buildPlaceholderLayers(svgMarkup: string): Layer[] {
  return [
    {
      id: 'placeholder-emoji',
      svgMarkup,
      transform: { ...IDENTITY_TRANSFORM },
    },
  ];
}

export const CANVAS_SIZE = 256;

type PreviewStatus = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-canvas-preview',
  template: `
    @if (status() === 'loading') {
      <p class="canvas-preview-status" data-testid="canvas-preview-loading">Loading…</p>
    }
    @if (status() === 'error') {
      <p class="canvas-preview-status canvas-preview-status--error" data-testid="canvas-preview-error">
        Failed to load emoji
      </p>
    }
    <canvas
      #canvas
      [width]="size"
      [height]="size"
      class="canvas-preview"
      [class.canvas-preview--hidden]="status() !== 'loaded'"
    ></canvas>
  `,
  styleUrl: './canvas-preview.scss',
})
export class CanvasPreview implements AfterViewInit {
  /**
   * Optional explicit layer stack. When provided, this overrides the default
   * placeholder-emoji CDN fetch entirely (used by future pickers/upload
   * flows). When omitted, the component fetches the placeholder emoji itself.
   */
  readonly layers = input<Layer[] | undefined>(undefined);
  readonly size = CANVAS_SIZE;

  /** Emits the resolved layer stack (explicit input or fetched placeholder) once it's ready to render. */
  readonly layersResolved = output<Layer[]>();

  readonly status = signal<PreviewStatus>('loading');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly emojiSource = inject(EmojiSourceService);
  private readonly viewReady = signal(false);

  constructor() {
    // Re-resolves whenever the explicit `layers` input changes (e.g. a
    // picker selection), not just once on initial view init.
    effect(() => {
      const explicitLayers = this.layers();
      if (!this.viewReady()) {
        return;
      }
      void this.init(explicitLayers);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  private async init(explicitLayers: Layer[] | undefined): Promise<void> {
    if (explicitLayers) {
      this.status.set('loaded');
      this.layersResolved.emit(explicitLayers);
      await this.render(explicitLayers);
      return;
    }

    this.status.set('loading');
    try {
      const svgMarkup = await this.emojiSource.fetchPlaceholderEmoji();
      const layers = buildPlaceholderLayers(svgMarkup);
      this.status.set('loaded');
      this.layersResolved.emit(layers);
      await this.render(layers);
    } catch {
      this.status.set('error');
    }
  }

  /** Renders the full layer stack onto the canvas, bottom layer first. */
  async render(layers: Layer[]): Promise<void> {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const rendered = await renderLayersToCanvas(layers, this.size);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rendered, 0, 0);
  }
}
