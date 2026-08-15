import { TestBed } from '@angular/core/testing';
import { EmojiPicker } from './emoji-picker';

describe('EmojiPicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmojiPicker],
    }).compileComponents();
  });

  function setSearch(fixture: ReturnType<typeof TestBed.createComponent<EmojiPicker>>, value: string): void {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="emoji-picker-search"]',
    ) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows a non-empty default result set with an empty search', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();
    expect(fixture.componentInstance.results().length).toBeGreaterThan(0);
  });

  it('filters results by keyword, case-insensitively', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'GRINNING_FACE');

    const results = fixture.componentInstance.results();
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((entry) =>
        entry.keywords.some((keyword) => keyword.toLowerCase().includes('grinning_face')),
      ),
    ).toBe(true);
  });

  it('finds car-related emoji even when "car" is not a substring of the primary keyword', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'car');

    const emojis = fixture.componentInstance.results().map((entry) => entry.emoji);
    expect(emojis).toContain('🚗');
    expect(emojis).toContain('🚙');
    expect(emojis).toContain('🚕');
  });

  it('shows a no-results state for a query matching nothing', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'zzzzzznotanemoji');

    expect(fixture.componentInstance.results()).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('[data-testid="emoji-picker-no-results"]'),
    ).toBeTruthy();
  });

  it('shows a hover popover with the name and synonyms when an item is focused/hovered', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'grinning_face');

    expect(fixture.nativeElement.querySelector('[data-testid="emoji-picker-popover"]')).toBeNull();

    const button = fixture.nativeElement.querySelector('.emoji-picker-item') as HTMLButtonElement;
    button.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    const popoverName = fixture.nativeElement.querySelector('.emoji-picker-popover-name') as HTMLElement;
    const popoverSynonyms = fixture.nativeElement.querySelector(
      '.emoji-picker-popover-synonyms',
    ) as HTMLElement;

    expect(popoverName.textContent).toBe('grinning face');
    expect(popoverSynonyms.textContent).toContain('face');

    button.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="emoji-picker-popover"]')).toBeNull();
  });

  it('entrySynonyms returns null when an entry has no keywords beyond its primary name', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    expect(
      fixture.componentInstance.entrySynonyms({ emoji: '🙂', keywords: ['slightly_smiling_face'], codepoints: '1f642' }),
    ).toBeNull();
  });

  it('emits emojiSelected with emoji/codepoints/name when an item is clicked', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'grinning_face');

    const emitted: unknown[] = [];
    fixture.componentInstance.emojiSelected.subscribe((event) => emitted.push(event));

    const button = fixture.nativeElement.querySelector('.emoji-picker-item') as HTMLButtonElement;
    button.click();

    expect(emitted).toEqual([{ emoji: '😀', codepoints: '1f600', name: 'grinning face' }]);
  });
});
