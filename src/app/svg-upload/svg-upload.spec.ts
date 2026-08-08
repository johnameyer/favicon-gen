import { TestBed } from '@angular/core/testing';
import { SvgUpload, MAX_SVG_FILE_SIZE_BYTES, readAndValidateSvgFile, validateSvgMarkup } from './svg-upload';

describe('validateSvgMarkup', () => {
  it('accepts well-formed SVG markup', () => {
    const result = validateSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>');
    expect(result.ok).toBe(true);
    expect(result.ok && result.svgMarkup).toContain('<rect');
  });

  it('rejects invalid XML', () => {
    const result = validateSvgMarkup('<svg><rect></svg');
    expect(result.ok).toBe(false);
  });

  it('rejects XML with a non-svg root element', () => {
    const result = validateSvgMarkup('<not-svg xmlns="http://www.w3.org/2000/svg"></not-svg>');
    expect(result.ok).toBe(false);
  });
});

describe('readAndValidateSvgFile', () => {
  it('accepts a valid small SVG file', async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    });
    const result = await readAndValidateSvgFile(file);
    expect(result.ok).toBe(true);
  });

  it('rejects a file that is too large', async () => {
    const bigContent = '<svg xmlns="http://www.w3.org/2000/svg">' + 'x'.repeat(MAX_SVG_FILE_SIZE_BYTES) + '</svg>';
    const file = new File([bigContent], 'icon.svg', { type: 'image/svg+xml' });
    const result = await readAndValidateSvgFile(file);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('too large');
  });

  it('rejects a non-SVG file by extension/type', async () => {
    const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
    const result = await readAndValidateSvgFile(file);
    expect(result.ok).toBe(false);
  });

  it('rejects garbage content even with an .svg extension', async () => {
    const file = new File(['this is not xml <<>>'], 'fake.svg', { type: 'image/svg+xml' });
    const result = await readAndValidateSvgFile(file);
    expect(result.ok).toBe(false);
  });
});

describe('SvgUpload component', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SvgUpload] }).compileComponents();
  });

  it('emits svgSelected and clears error on a valid file', async () => {
    const fixture = TestBed.createComponent(SvgUpload);
    const component = fixture.componentInstance;
    const emitted: string[] = [];
    component.svgSelected.subscribe((markup) => emitted.push(markup));

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    });
    await component.handleFile(file);

    expect(emitted).toHaveLength(1);
    expect(component.error()).toBeNull();
  });

  it('shows an error and does not emit for an invalid file', async () => {
    const fixture = TestBed.createComponent(SvgUpload);
    const component = fixture.componentInstance;
    const emitted: string[] = [];
    component.svgSelected.subscribe((markup) => emitted.push(markup));

    const file = new File(['not svg at all'], 'notes.txt', { type: 'text/plain' });
    await component.handleFile(file);

    expect(emitted).toHaveLength(0);
    expect(component.error()).toBeTruthy();
  });

  it('handles a file input change event', async () => {
    const fixture = TestBed.createComponent(SvgUpload);
    const component = fixture.componentInstance;
    const emitted: string[] = [];
    component.svgSelected.subscribe((markup) => emitted.push(markup));

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file], writable: false });

    await component.onFileInputChange({ target: input } as unknown as Event);

    expect(emitted).toHaveLength(1);
  });
});
