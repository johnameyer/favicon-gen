import { loadFont, parseFontFaceRules, pickFontFaceRule } from './font-loader';

const GOOGLE_STYLE_CSS = `
/* cyrillic */
@font-face {
  font-family: 'Example';
  src: url(https://fonts.gstatic.com/s/example/cyrillic.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491;
}
/* latin */
@font-face {
  font-family: 'Example';
  src: url(https://fonts.gstatic.com/s/example/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+20??;
}
`;

/** Like Google's response for `family=Example:ital@0;1`: normal and italic faces per subset. */
const ITALIC_CSS = `
@font-face {
  font-family: 'Example';
  font-style: italic;
  src: url(https://fonts.gstatic.com/s/example/latin-italic.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'Example';
  font-style: oblique 0deg 10deg;
  src: url(https://fonts.gstatic.com/s/example/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

describe('parseFontFaceRules', () => {
  it('extracts each rule URL and unicode-range', () => {
    const rules = parseFontFaceRules(GOOGLE_STYLE_CSS, 'https://fonts.googleapis.com/css2');
    expect(rules.map((rule) => rule.src)).toEqual([
      'https://fonts.gstatic.com/s/example/cyrillic.woff2',
      'https://fonts.gstatic.com/s/example/latin.woff2',
    ]);
    expect(rules[1].ranges).toEqual([
      [0x0000, 0x00ff],
      [0x0131, 0x0131],
      [0x2000, 0x20ff],
    ]);
  });

  it('resolves relative URLs against the stylesheet URL', () => {
    const rules = parseFontFaceRules(
      "@font-face { src: url('fonts/a.ttf'); }",
      'https://example.com/css/site.css',
    );
    expect(rules[0].src).toBe('https://example.com/css/fonts/a.ttf');
    expect(rules[0].ranges).toEqual([]);
  });
});

describe('pickFontFaceRule', () => {
  const rules = parseFontFaceRules(GOOGLE_STYLE_CSS, 'https://fonts.googleapis.com/css2');

  it('picks the subset covering the letter', () => {
    expect(pickFontFaceRule(rules, 'A')?.src).toContain('latin');
    expect(pickFontFaceRule(rules, 'Ж')?.src).toContain('cyrillic');
  });

  it('falls back to the first rule when nothing covers the letter', () => {
    expect(pickFontFaceRule(rules, '漢')?.src).toContain('cyrillic');
  });
});

describe('pickFontFaceRule by style', () => {
  const rules = parseFontFaceRules(ITALIC_CSS, 'https://fonts.googleapis.com/css2');

  it("treats only font-style: italic as italic (Google's oblique range is the normal face)", () => {
    expect(rules.map((rule) => rule.italic)).toEqual([true, false]);
    expect(pickFontFaceRule(rules, 'A')?.src).toContain('latin.woff2');
    expect(pickFontFaceRule(rules, 'A', true)?.src).toContain('latin-italic.woff2');
  });

  it('has no italic rule for a stylesheet without italic faces', () => {
    const plain = parseFontFaceRules(GOOGLE_STYLE_CSS, 'https://fonts.googleapis.com/css2');
    expect(pickFontFaceRule(plain, 'A', true)).toBeUndefined();
  });
});

describe('loadFont', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(responses: Record<string, Response>) {
    const fetchMock = vi.fn(async (url: string) => {
      const response = responses[url];
      if (!response) {
        throw new TypeError('Failed to fetch');
      }
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('embeds a direct font file as a base64 data URL', async () => {
    stubFetch({
      'https://example.com/a.woff2': new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'application/octet-stream' },
      }),
    });
    await expect(loadFont('https://example.com/a.woff2', 'A')).resolves.toEqual({
      normal: 'data:font/woff2;base64,AQID',
      italic: undefined,
      axes: [],
    });
  });

  it('follows a stylesheet to the font file covering the letter', async () => {
    const fetchMock = stubFetch({
      'https://fonts.googleapis.com/css2?family=Example': new Response(GOOGLE_STYLE_CSS, {
        headers: { 'content-type': 'text/css; charset=utf-8' },
      }),
      'https://fonts.gstatic.com/s/example/latin.woff2': new Response(new Uint8Array([4, 5]), {
        headers: { 'content-type': 'font/woff2' },
      }),
    });
    const font = await loadFont('https://fonts.googleapis.com/css2?family=Example', 'Q');
    expect(font.normal).toBe('data:font/woff2;base64,BAU=');
    expect(font.italic).toBeUndefined();
    expect(fetchMock).toHaveBeenLastCalledWith('https://fonts.gstatic.com/s/example/latin.woff2');
  });

  it("also embeds the stylesheet's italic face when it has one", async () => {
    stubFetch({
      'https://fonts.googleapis.com/css2?family=Example:ital@0;1': new Response(ITALIC_CSS, {
        headers: { 'content-type': 'text/css' },
      }),
      'https://fonts.gstatic.com/s/example/latin.woff2': new Response(new Uint8Array([4, 5]), {
        headers: { 'content-type': 'font/woff2' },
      }),
      'https://fonts.gstatic.com/s/example/latin-italic.woff2': new Response(
        new Uint8Array([6, 7]),
        { headers: { 'content-type': 'font/woff2' } },
      ),
    });
    const font = await loadFont('https://fonts.googleapis.com/css2?family=Example:ital@0;1', 'A');
    expect(font.normal).toBe('data:font/woff2;base64,BAU=');
    expect(font.italic).toBe('data:font/woff2;base64,Bgc=');
  });

  it('rejects non-http URLs without fetching', async () => {
    const fetchMock = stubFetch({});
    await expect(loadFont('javascript:alert(1)', 'A')).rejects.toThrow('http');
    await expect(loadFont('not a url', 'A')).rejects.toThrow('valid URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports network/CORS and HTTP failures', async () => {
    stubFetch({ 'https://example.com/missing.ttf': new Response('', { status: 404 }) });
    await expect(loadFont('https://example.com/missing.ttf', 'A')).rejects.toThrow('404');
    await expect(loadFont('https://blocked.example.com/a.ttf', 'A')).rejects.toThrow(
      'cross-origin',
    );
  });

  it('reports a stylesheet with no font URLs', async () => {
    stubFetch({
      'https://example.com/empty.css': new Response('body {}', {
        headers: { 'content-type': 'text/css' },
      }),
    });
    await expect(loadFont('https://example.com/empty.css', 'A')).rejects.toThrow('@font-face');
  });
});
