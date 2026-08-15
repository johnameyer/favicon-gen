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

  describe('per-member overrides', () => {
    it('toggling expanded state shows/hides per-member controls', () => {
      const fixture = create();
      const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
      expect(fixture.componentInstance.expandedGroups().has(redGroup.id)).toBe(false);

      fixture.componentInstance.toggleExpanded(redGroup.id);
      fixture.detectChanges();
      expect(fixture.componentInstance.expandedGroups().has(redGroup.id)).toBe(true);
      expect(fixture.nativeElement.querySelectorAll('[data-testid="recolor-member"]').length).toBe(
        redGroup.colors.length,
      );

      fixture.componentInstance.toggleExpanded(redGroup.id);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="recolor-member"]').length).toBe(0);
    });

    it('an individual member override changes just that member emitted color, independent of the group picker', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
      fixture.componentInstance.onColorPicked(redGroup, { target: { value: '#0000ff' } } as unknown as Event);
      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);

      const last = emitted[emitted.length - 1];
      expect(last['#D70617']).toBe('#123456');
      // group picker's computed value for the dominant color is unaffected
      expect(last['#F92612']).toBe('#0000FF');
    });

    it('an individual override works even without a group-level pick', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);

      const last = emitted[emitted.length - 1];
      expect(last['#D70617']).toBe('#123456');
      expect(last['#F92612']).toBeUndefined();
    });

    it('clearing a member override reverts it to the group-computed value', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
      fixture.componentInstance.onColorPicked(redGroup, { target: { value: '#0000ff' } } as unknown as Event);
      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);

      const groupComputed = emitted[0]['#D70617']; // from the group-level pick alone
      fixture.componentInstance.clearMemberOverride('#D70617');

      const last = emitted[emitted.length - 1];
      expect(last['#D70617']).toBe(groupComputed);
    });

    it('clearing a member override reverts to unchanged when the group itself has no chosen color', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);
      fixture.componentInstance.clearMemberOverride('#D70617');

      const last = emitted[emitted.length - 1];
      expect(last['#D70617']).toBeUndefined();
    });

    it('reset clears both group-level picks and individual member overrides', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
      fixture.componentInstance.onColorPicked(redGroup, { target: { value: '#0000ff' } } as unknown as Event);
      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);

      fixture.componentInstance.reset();

      expect(emitted[emitted.length - 1]).toEqual({});
      expect(fixture.componentInstance.memberOverrides()).toEqual({});
    });

    it('preserves member overrides across a split into single-color groups', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      const redGroup = fixture.componentInstance.groups().find((g) => g.colors.includes('#F92612'))!;
      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);

      fixture.componentInstance.split(redGroup);

      const last = emitted[emitted.length - 1];
      expect(last['#D70617']).toBe('#123456');
    });

    it('preserves member overrides across a merge', () => {
      const fixture = create();
      const emitted: Record<string, string>[] = [];
      fixture.componentInstance.colorsChanged.subscribe((v: Record<string, string>) => emitted.push(v));

      fixture.componentInstance.onMemberColorPicked('#D70617', { target: { value: '#123456' } } as unknown as Event);

      const groupsBefore = fixture.componentInstance.groups();
      for (const g of groupsBefore) {
        fixture.componentInstance.toggleSelected(g.id);
      }
      fixture.componentInstance.mergeSelected();

      const last = emitted[emitted.length - 1];
      expect(last['#D70617']).toBe('#123456');
    });
  });

  it('keeps a gradient\'s stops in one group by construction, even across a wide hue span', () => {
    const gradientSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <radialGradient id="SVGID_1_" cx="24" cy="20" r="15">
        <stop offset="0.3" style="stop-color:#FF9800"/>
        <stop offset="0.6" style="stop-color:#FF6D00"/>
        <stop offset="1" style="stop-color:#F44336"/>
      </radialGradient>
      <path style="fill:url(#SVGID_1_);" d="M0,0z"/>
    </svg>`;
    const fixture = create(gradientSvg);
    const groups = fixture.componentInstance.groups();
    expect(groups.length).toBe(1);
    expect(groups[0].colors).toEqual(expect.arrayContaining(['#FF9800', '#FF6D00', '#F44336']));
  });
});
