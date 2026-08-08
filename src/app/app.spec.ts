import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { EmojiSourceService } from './canvas/emoji-source.service';
import { FaviconExportService } from './export/favicon-export.service';

describe('App', () => {
  let fetchEmoji: ReturnType<typeof vi.fn>;
  let exportIco: ReturnType<typeof vi.fn>;
  let exportBundle: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchEmoji = vi.fn().mockResolvedValue('<svg>mock</svg>');
    exportIco = vi.fn().mockResolvedValue(new Blob(['ico'], { type: 'image/x-icon' }));
    exportBundle = vi.fn().mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }));
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: EmojiSourceService, useValue: { fetchEmoji, fetchPlaceholderEmoji: fetchEmoji } },
        { provide: FaviconExportService, useValue: { exportIco, exportBundle } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render a canvas preview and an emoji picker', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-canvas-preview')).toBeTruthy();
    expect(compiled.querySelector('app-emoji-picker')).toBeTruthy();
  });

  it('fetches SVG markup and updates selectedLayers when an emoji is selected', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    await fixture.componentInstance.onEmojiSelected({
      emoji: '🐱',
      codepoints: '1f431',
      name: 'cat face',
    });

    expect(fetchEmoji).toHaveBeenCalledWith('1f431');
    expect(fixture.componentInstance.selectedLayers()).toHaveLength(1);
    expect(fixture.componentInstance.selectedLayers()?.[0].svgMarkup).toBe('<svg>mock</svg>');
    expect(fixture.componentInstance.selectionLoading()).toBe(false);
  });

  it('loads uploaded SVG markup as the current source via the shared method', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    fixture.componentInstance.onSvgUploaded('<svg>uploaded</svg>');

    expect(fixture.componentInstance.selectedLayers()).toHaveLength(1);
    expect(fixture.componentInstance.selectedLayers()?.[0].svgMarkup).toBe('<svg>uploaded</svg>');
  });

  describe('export mode toggle', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    it('defaults to bundle mode', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(fixture.componentInstance.exportMode()).toBe('bundle');
    });

    it('calls exportBundle and downloads favicon-package.zip in bundle mode', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const app = fixture.componentInstance;

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      let downloadedFilename: string | undefined;
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        downloadedFilename = (node as HTMLAnchorElement).download;
        return node;
      });

      await app.download();

      expect(exportBundle).toHaveBeenCalledWith(app.currentLayers());
      expect(exportIco).not.toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(downloadedFilename).toBe('favicon-package.zip');
      clickSpy.mockRestore();
      appendSpy.mockRestore();
    });

    it('calls exportIco and downloads favicon.ico in ico mode', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const app = fixture.componentInstance;
      app.setExportMode('ico');

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      let downloadedFilename: string | undefined;
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        downloadedFilename = (node as HTMLAnchorElement).download;
        return node;
      });

      await app.download();

      expect(exportIco).toHaveBeenCalledWith(app.currentLayers());
      expect(exportBundle).not.toHaveBeenCalled();
      expect(downloadedFilename).toBe('favicon.ico');
      clickSpy.mockRestore();
      appendSpy.mockRestore();
    });
  });

  it('switches tabs and renders the corresponding source component', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-emoji-picker')).toBeTruthy();
    expect(compiled.querySelector('app-svg-upload')).toBeFalsy();

    fixture.componentInstance.setActiveTab('upload');
    fixture.detectChanges();

    expect(compiled.querySelector('app-svg-upload')).toBeTruthy();
    expect(compiled.querySelector('app-emoji-picker')).toBeFalsy();
  });
});
