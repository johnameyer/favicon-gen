import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { EmojiSourceService } from './canvas/emoji-source.service';

describe('App', () => {
  let fetchEmoji: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchEmoji = vi.fn().mockResolvedValue('<svg>mock</svg>');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: EmojiSourceService, useValue: { fetchEmoji, fetchPlaceholderEmoji: fetchEmoji } }],
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
});
