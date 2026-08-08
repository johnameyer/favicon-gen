import { TestBed } from '@angular/core/testing';
import { CanvasPreview, CANVAS_SIZE, createDefaultLayers } from './canvas-preview';
import { IDENTITY_TRANSFORM } from '../models/layer';
import { EMOJI_PLACEHOLDER_SVG } from './emoji-placeholder';

describe('createDefaultLayers', () => {
  it('seeds a single layer wrapping the placeholder emoji', () => {
    const layers = createDefaultLayers();
    expect(layers).toHaveLength(1);
    expect(layers[0].svgMarkup).toBe(EMOJI_PLACEHOLDER_SVG);
    expect(layers[0].transform).toEqual(IDENTITY_TRANSFORM);
  });

  it('returns a fresh array/transform each call (not shared mutable state)', () => {
    const a = createDefaultLayers();
    const b = createDefaultLayers();
    expect(a).not.toBe(b);
    expect(a[0].transform).not.toBe(b[0].transform);
  });
});

describe('CanvasPreview', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasPreview],
    }).compileComponents();
  });

  it('creates the component with default layers', () => {
    const fixture = TestBed.createComponent(CanvasPreview);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
    expect(component.layers()).toHaveLength(1);
    expect(component.size).toBe(CANVAS_SIZE);
  });

  it('renders a canvas element sized to CANVAS_SIZE', () => {
    const fixture = TestBed.createComponent(CanvasPreview);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBe(CANVAS_SIZE);
    expect(canvas.height).toBe(CANVAS_SIZE);
  });

  it('accepts a custom layer stack via the layers input', () => {
    const fixture = TestBed.createComponent(CanvasPreview);
    fixture.componentRef.setInput('layers', [
      { id: 'a', svgMarkup: '<svg></svg>', transform: { x: 0, y: 0, scale: 1, rotation: 0 } },
      { id: 'b', svgMarkup: '<svg></svg>', transform: { x: 0, y: 0, scale: 1, rotation: 0 } },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.layers()).toHaveLength(2);
  });
});
