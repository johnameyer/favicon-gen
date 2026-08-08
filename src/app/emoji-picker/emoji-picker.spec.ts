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

  it('filters results by name, case-insensitively', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'GRINNING FACE');

    const results = fixture.componentInstance.results();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((entry) => entry.name.toLowerCase().includes('grinning face'))).toBe(true);
  });

  it('filters results by slug', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'grinning_face');

    expect(fixture.componentInstance.results().length).toBeGreaterThan(0);
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

  it('emits emojiSelected with emoji/codepoints/name when an item is clicked', () => {
    const fixture = TestBed.createComponent(EmojiPicker);
    fixture.detectChanges();

    setSearch(fixture, 'grinning face');

    const emitted: unknown[] = [];
    fixture.componentInstance.emojiSelected.subscribe((event) => emitted.push(event));

    const button = fixture.nativeElement.querySelector('.emoji-picker-item') as HTMLButtonElement;
    button.click();

    expect(emitted).toEqual([{ emoji: '😀', codepoints: '1f600', name: 'grinning face' }]);
  });
});
