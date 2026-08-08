import { TestBed } from '@angular/core/testing';
import { CanvasPreview, CANVAS_SIZE, buildPlaceholderLayers } from './canvas-preview';
import { IDENTITY_TRANSFORM } from '../models/layer';
import { EmojiSourceService } from './emoji-source.service';

describe('buildPlaceholderLayers', () => {
  it('wraps the given SVG markup in a single centered layer', () => {
    const layers = buildPlaceholderLayers('<svg>mock</svg>');
    expect(layers).toHaveLength(1);
    expect(layers[0].svgMarkup).toBe('<svg>mock</svg>');
    expect(layers[0].transform).toEqual(IDENTITY_TRANSFORM);
  });

  it('returns a fresh array/transform each call (not shared mutable state)', () => {
    const a = buildPlaceholderLayers('<svg></svg>');
    const b = buildPlaceholderLayers('<svg></svg>');
    expect(a).not.toBe(b);
    expect(a[0].transform).not.toBe(b[0].transform);
  });
});

describe('CanvasPreview', () => {
  let fetchPlaceholderEmoji: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchPlaceholderEmoji = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CanvasPreview],
      providers: [
        {
          provide: EmojiSourceService,
          useValue: { fetchPlaceholderEmoji },
        },
      ],
    }).compileComponents();
  });

  it('creates the component with no explicit layers by default', () => {
    const fixture = TestBed.createComponent(CanvasPreview);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
    expect(component.layers()).toBeUndefined();
    expect(component.size).toBe(CANVAS_SIZE);
  });

  it('renders a canvas element sized to CANVAS_SIZE', () => {
    fetchPlaceholderEmoji.mockResolvedValue('<svg></svg>');
    const fixture = TestBed.createComponent(CanvasPreview);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBe(CANVAS_SIZE);
    expect(canvas.height).toBe(CANVAS_SIZE);
  });

  it('shows a loading state while the placeholder emoji fetch is in flight, then loaded', async () => {
    let resolveFetch: (value: string) => void;
    fetchPlaceholderEmoji.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const fixture = TestBed.createComponent(CanvasPreview);
    fixture.detectChanges();
    expect(fixture.componentInstance.status()).toBe('loading');
    expect(fixture.nativeElement.querySelector('[data-testid="canvas-preview-loading"]')).toBeTruthy();

    resolveFetch!('<svg></svg>');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('loaded');
    expect(fixture.nativeElement.querySelector('[data-testid="canvas-preview-loading"]')).toBeFalsy();
  });

  it('shows an error state when the placeholder emoji fetch fails', async () => {
    fetchPlaceholderEmoji.mockRejectedValue(new Error('boom'));

    const fixture = TestBed.createComponent(CanvasPreview);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.status()).toBe('error');
    expect(fixture.nativeElement.querySelector('[data-testid="canvas-preview-error"]')).toBeTruthy();
  });

  it('accepts a custom layer stack via the layers input, skipping the CDN fetch', async () => {
    const fixture = TestBed.createComponent(CanvasPreview);
    fixture.componentRef.setInput('layers', [
      { id: 'a', svgMarkup: '<svg></svg>', transform: { x: 0, y: 0, scale: 1, rotation: 0 } },
      { id: 'b', svgMarkup: '<svg></svg>', transform: { x: 0, y: 0, scale: 1, rotation: 0 } },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.layers()).toHaveLength(2);
    expect(fixture.componentInstance.status()).toBe('loaded');
    expect(fetchPlaceholderEmoji).not.toHaveBeenCalled();
  });
});
