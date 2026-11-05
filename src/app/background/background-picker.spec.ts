import { TestBed } from '@angular/core/testing';
import { BackgroundPicker } from './background-picker';
import { DEFAULT_BACKGROUND } from './background';

describe('BackgroundPicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BackgroundPicker] }).compileComponents();
  });

  it('shows the color picker and size slider only when a shape is selected', () => {
    const fixture = TestBed.createComponent(BackgroundPicker);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="background-color"]')).toBeFalsy();
    expect(root.querySelector('[data-testid="background-content-size"]')).toBeFalsy();

    fixture.componentInstance.update({ shape: 'circle' });
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="background-color"]')).toBeTruthy();
  });

  it('updates the two-way bound background from the controls', () => {
    const fixture = TestBed.createComponent(BackgroundPicker);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const select = root.querySelector<HTMLSelectElement>('[data-testid="background-shape"]')!;
    select.value = 'rounded-square';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const color = root.querySelector<HTMLInputElement>('[data-testid="background-color"]')!;
    color.value = '#ff0000';
    color.dispatchEvent(new Event('input'));

    const size = root.querySelector<HTMLInputElement>('[data-testid="background-content-size"]')!;
    expect(size.value).toBe('68');
    size.value = '85';
    size.dispatchEvent(new Event('input'));

    expect(fixture.componentInstance.background()).toEqual({
      ...DEFAULT_BACKGROUND,
      shape: 'rounded-square',
      color: '#FF0000',
      contentScale: 0.85,
    });
  });

  it('shows corner radius only for the square, and gradient controls only for gradients', () => {
    const fixture = TestBed.createComponent(BackgroundPicker);
    const query = (id: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
    const set = (changes: object) => {
      fixture.componentInstance.update(changes);
      fixture.detectChanges();
    };

    set({ shape: 'rounded-square', fill: 'solid' });
    expect(query('background-corner-radius')).toBeTruthy();
    expect(query('background-color2')).toBeFalsy();
    expect(query('background-angle')).toBeFalsy();

    set({ shape: 'circle', fill: 'linear' });
    expect(query('background-corner-radius')).toBeFalsy();
    expect(query('background-color2')).toBeTruthy();
    expect(query('background-angle')).toBeTruthy();

    set({ fill: 'radial' });
    expect(query('background-color2')).toBeTruthy();
    expect(query('background-angle')).toBeFalsy();
  });
});
