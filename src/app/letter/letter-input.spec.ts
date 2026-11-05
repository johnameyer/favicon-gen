import { TestBed } from '@angular/core/testing';
import { DEFAULT_CUSTOM_FONT_URL, LetterInput } from './letter-input';

/** Lets pending emits (which await glyph measurement) and font loads finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

const fontResponse = (bytes: number[]) =>
  new Response(new Uint8Array(bytes), { headers: { 'content-type': 'font/woff2' } });

describe('LetterInput', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Choosing "Custom URL…" fetches the prefilled font; by default that
    // fetch never settles, so tests see the sans-serif fallback unless they say otherwise.
    fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.configureTestingModule({ imports: [LetterInput] }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setup() {
    const fixture = TestBed.createComponent(LetterInput);
    const emitted: string[] = [];
    fixture.componentInstance.svgGenerated.subscribe((svg) => emitted.push(svg));
    fixture.detectChanges();
    await settle();
    return { fixture, component: fixture.componentInstance, emitted };
  }

  async function typeInto(
    fixture: Awaited<ReturnType<typeof setup>>['fixture'],
    value: string,
  ): Promise<HTMLInputElement> {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-testid="letter-input"]',
    )!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
    return input;
  }

  const query = (fixture: Awaited<ReturnType<typeof setup>>['fixture'], testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);

  it('emits the default letter in sans-serif on init, without fetching any font', async () => {
    const { component, emitted } = await setup();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toContain('>A</text>');
    expect(emitted[0]).toContain('font-family="sans-serif"');
    expect(component.options().font).toBe('sans-serif');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the prefilled Roboto Flex the first time Custom URL is chosen, and only then', async () => {
    const { fixture, component } = await setup();
    await component.update({ font: 'custom' });
    fixture.detectChanges();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(DEFAULT_CUSTOM_FONT_URL);
    expect((query(fixture, 'letter-font-url') as HTMLInputElement).value).toBe(
      DEFAULT_CUSTOM_FONT_URL,
    );
    expect(component.fontLoading()).toBe(true);

    // Switching away and back while it's still loading doesn't fetch again.
    await component.update({ font: 'serif' });
    await component.update({ font: 'custom' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps the newly typed character when typing after the existing letter', async () => {
    const { fixture, component, emitted } = await setup();
    const input = await typeInto(fixture, 'AB');
    expect(input.value).toBe('B');
    expect(component.options().letter).toBe('B');
    expect(emitted.at(-1)).toContain('>B</text>');
  });

  it('keeps only the first character of pasted text', async () => {
    const { fixture, component } = await setup();
    await typeInto(fixture, 'Hello');
    expect(component.options().letter).toBe('H');
  });

  it('does not emit when the field is cleared', async () => {
    const { fixture, component, emitted } = await setup();
    await typeInto(fixture, '');
    expect(emitted).toHaveLength(1);
    expect(component.options().letter).toBe('A');
  });

  it('re-emits when an option changes', async () => {
    const { component, emitted } = await setup();
    await component.update({ color: '#FF0000', font: 'serif', weight: 300, italic: true });
    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toContain('fill="#FF0000"');
    expect(emitted[1]).toContain('font-family="serif"');
    expect(emitted[1]).toContain('font-weight="300"');
    expect(emitted[1]).toContain('font-style="italic"');
  });

  it('shows the weight slider and italic toggle for generic fonts', async () => {
    const { fixture, component } = await setup();
    await component.update({ font: 'serif' });
    fixture.detectChanges();
    expect(query(fixture, 'letter-weight')).toBeTruthy();
    expect(query(fixture, 'letter-italic')).toBeTruthy();
    expect(query(fixture, 'letter-font-url')).toBeFalsy();
  });

  describe('custom font', () => {
    it('embeds the loaded font and re-emits', async () => {
      fetchMock.mockImplementation(async () => fontResponse([0, 0, 0]));
      const { component, emitted } = await setup();
      await component.update({ font: 'custom' });

      await component.loadCustomFont(' https://example.com/a.woff2 ');

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/a.woff2');
      expect(component.options().customFontUrl).toBe('https://example.com/a.woff2');
      expect(component.fontLoading()).toBe(false);
      expect(emitted.at(-1)).toContain('data:font/woff2;base64,AAAA');
    });

    it('shows a slider per axis, with wght replacing the generic weight slider', async () => {
      const { fixture, component } = await setup();
      await component.update({ font: 'custom' });
      component.customFont.set({
        normal: 'data:font/woff2;base64,AAAA',
        axes: [
          { tag: 'wght', min: 100, default: 400, max: 1000, hidden: false },
          { tag: 'YTUC', min: 528, default: 712, max: 760, hidden: true },
        ],
      });
      fixture.detectChanges();

      expect(query(fixture, 'letter-weight')).toBeFalsy();
      expect(query(fixture, 'letter-axis-wght')?.closest('label')?.textContent).toContain('Weight');
      expect(query(fixture, 'letter-axis-YTUC')?.closest('label')?.textContent).toContain(
        'Uppercase height',
      );

      await component.setAxis('YTUC', 600);
      expect(component.options().axes).toEqual({ YTUC: 600 });
    });

    it('starts a new wght axis at the current weight, other axes at their defaults', async () => {
      const { component } = await setup();
      // A real fvar can't come through a stubbed fetch cheaply, so check the
      // mapping directly via a font whose axes the loader would report.
      const font = {
        normal: 'data:font/woff2;base64,AAAA',
        axes: [
          { tag: 'wght', min: 100, default: 400, max: 1000, hidden: false },
          { tag: 'opsz', min: 8, default: 14, max: 144, hidden: false },
        ],
      };
      const axes = component['initialAxes'](font, { ...component.options(), weight: 700 });
      expect(axes).toEqual({ wght: 700, opsz: 14 });
      // Values already chosen survive a reload (e.g. for a new letter's subset).
      expect(
        component['initialAxes'](font, { ...component.options(), axes: { opsz: 40 } }),
      ).toEqual({
        wght: 700,
        opsz: 40,
      });
    });

    it('shows the error and keeps the fallback font on failure', async () => {
      fetchMock.mockImplementation(async () => new Response('', { status: 404 }));
      const { fixture, component, emitted } = await setup();
      await component.update({ font: 'custom' });
      const emittedBefore = emitted.length;

      await component.loadCustomFont('https://example.com/a.woff2');
      fixture.detectChanges();

      expect(component.fontError()).toContain('404');
      expect(emitted).toHaveLength(emittedBefore);
      expect(query(fixture, 'letter-font-error')?.textContent).toContain('404');
    });

    it('ignores a slower, superseded load', async () => {
      let resolveFirst!: (value: Response) => void;
      const { component } = await setup();
      fetchMock
        .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce(fontResponse([0x35, 0x10]));

      const first = component.loadCustomFont('https://example.com/old.woff2');
      await component.loadCustomFont('https://example.com/new.woff2');
      resolveFirst(fontResponse([0x38, 0xe1]));
      await first;

      expect(component.customFont()?.normal).toBe('data:font/woff2;base64,NRA=');
    });
  });
});
