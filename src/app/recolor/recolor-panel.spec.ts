import { TestBed } from '@angular/core/testing';
import { RecolorPanel } from './recolor-panel';

describe('RecolorPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecolorPanel],
    }).compileComponents();
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <path style="fill:#F92612;" />
    <path style="fill:#D70617;" />
    <path style="fill:#C8C8C8;" />
  </svg>`;

  function create(markup?: string) {
    const fixture = TestBed.createComponent(RecolorPanel);
    fixture.componentRef.setInput('svgMarkup', markup === undefined ? svg : markup);
    fixture.detectChanges();
    return fixture;
  }

  function createWithoutMarkup() {
    const fixture = TestBed.createComponent(RecolorPanel);
    fixture.detectChanges();
    return fixture;
  }

  it('computes suggested groups from the input SVG', () => {
    const fixture = create();
    const groups = fixture.componentInstance.groups();
    expect(groups.length).toBe(2); // reds grouped together, gray on its own
    const redGroup = groups.find((g) => g.colors.includes('#F92612'));
    expect(redGroup?.colors).toEqual(expect.arrayContaining(['#F92612', '#D70617']));
    const grayGroup = groups.find((g) => g.colors.includes('#C8C8C8'));
    expect(grayGroup?.colors).toEqual(['#C8C8C8']);
  });

  it('shows nothing when there is no svgMarkup input', () => {
    const fixture = createWithoutMarkup();
    expect(fixture.componentInstance.groups()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="recolor-group"]')).toBeNull();
  });

  it('emits colorsChanged with a recolor map when a picker changes', () => {
    const fixture = create();
    const emitted: Record<string, string>[] = [];
    fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

    const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
    fixture.componentInstance.onColorPicked(redGroup, { target: { value: '#0000ff' } } as unknown as Event);

    expect(emitted.length).toBe(1);
    expect(emitted[0]['#F92612']).toBe('#0000FF');
    expect(emitted[0]['#D70617']).toBeDefined();
    // gray group untouched, no entry
    expect(emitted[0]['#C8C8C8']).toBeUndefined();
  });

  it('split ungroups a multi-color group back into single-color groups', () => {
    const fixture = create();
    const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
    expect(redGroup.colors.length).toBeGreaterThan(1);

    fixture.componentInstance.split(redGroup);

    const groups = fixture.componentInstance.groups();
    expect(groups.find((g) => g.colors.length > 1 && g.colors.includes('#F92612'))).toBeUndefined();
    expect(groups.find((g) => g.colors.length === 1 && g.colors[0] === '#F92612')).toBeDefined();
    expect(groups.find((g) => g.colors.length === 1 && g.colors[0] === '#D70617')).toBeDefined();
  });

  it('merge combines selected groups into one', () => {
    const fixture = create();
    const groupsBefore = fixture.componentInstance.groups();
    expect(groupsBefore.length).toBe(2);

    for (const g of groupsBefore) {
      fixture.componentInstance.toggleSelected(g.id);
    }
    fixture.componentInstance.mergeSelected();

    const groupsAfter = fixture.componentInstance.groups();
    expect(groupsAfter.length).toBe(1);
    expect(groupsAfter[0].colors).toEqual(expect.arrayContaining(['#F92612', '#D70617', '#C8C8C8']));
  });

  it('does not merge when fewer than two groups are selected', () => {
    const fixture = create();
    const [first] = fixture.componentInstance.groups();
    fixture.componentInstance.toggleSelected(first.id);
    fixture.componentInstance.mergeSelected();
    expect(fixture.componentInstance.groups().length).toBe(2);
  });

  it('reset clears all overrides back to original, emitting an empty map', () => {
    const fixture = create();
    const emitted: Record<string, string>[] = [];
    fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

    const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
    fixture.componentInstance.onColorPicked(redGroup, { target: { value: '#0000ff' } } as unknown as Event);

    fixture.componentInstance.reset();

    expect(emitted[emitted.length - 1]).toEqual({});
    expect(fixture.componentInstance.currentColorFor(redGroup)).toBe('#F92612');
  });
});
