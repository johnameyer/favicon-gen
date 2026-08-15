import { TestBed } from '@angular/core/testing';
import { EmojiSourceService, emojiToCodepoints, resolveEmojiSvgUrl } from './emoji-source.service';

describe('emojiToCodepoints', () => {
  it('converts a single-codepoint emoji', () => {
    expect(emojiToCodepoints('😀')).toBe('1f600');
  });

  it('converts a multi-codepoint ZWJ sequence emoji', () => {
    // Family: man, woman, girl
    expect(emojiToCodepoints('👨‍👩‍👧')).toBe('1f468_200d_1f469_200d_1f467');
  });

  it('strips variation selector-16 (U+FE0F)', () => {
    expect(emojiToCodepoints('❤️')).toBe('2764');
  });
});

describe('resolveEmojiSvgUrl', () => {
  it('routes a regional-indicator country flag (🇺🇸) to region-flags/svg/US.svg', () => {
    expect(resolveEmojiSvgUrl(emojiToCodepoints('🇺🇸'))).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/third_party/region-flags/svg/US.svg',
    );
  });

  it('routes a regional-indicator country flag (🇫🇷) to region-flags/svg/FR.svg', () => {
    expect(resolveEmojiSvgUrl(emojiToCodepoints('🇫🇷'))).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/third_party/region-flags/svg/FR.svg',
    );
  });

  it('routes a tag-sequence subdivision flag (England) to region-flags/svg/GB-ENG.svg', () => {
    // Black flag base + tag chars spelling "gbeng" + terminator.
    expect(resolveEmojiSvgUrl('1f3f4_e0067_e0062_e0065_e006e_e0067_e007f')).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/third_party/region-flags/svg/GB-ENG.svg',
    );
  });

  it('routes a tag-sequence subdivision flag (Scotland) to region-flags/svg/GB-SCT.svg', () => {
    expect(resolveEmojiSvgUrl('1f3f4_e0067_e0062_e0073_e0063_e0074_e007f')).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/third_party/region-flags/svg/GB-SCT.svg',
    );
  });

  it('leaves a normal single-codepoint emoji on the standard svg path', () => {
    expect(resolveEmojiSvgUrl('1f600')).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f600.svg',
    );
  });

  it('leaves a non-flag multi-codepoint ZWJ sequence (family) on the standard svg path', () => {
    expect(resolveEmojiSvgUrl('1f468_200d_1f469_200d_1f467')).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f468_200d_1f469_200d_1f467.svg',
    );
  });

  it('leaves a simple flag symbol (chequered flag, single codepoint) on the standard svg path', () => {
    expect(resolveEmojiSvgUrl('1f3c1')).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f3c1.svg',
    );
  });
});

describe('EmojiSourceService', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('fetchEmoji', () => {
    it('resolves with SVG text on a successful fetch, building the URL from codepoints', async () => {
      const svg = '<svg>mock emoji</svg>';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(svg),
      } as Response);

      const service = TestBed.inject(EmojiSourceService);
      await expect(service.fetchEmoji('1f468_200d_1f469_200d_1f467')).resolves.toBe(svg);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f468_200d_1f469_200d_1f467.svg',
      );
    });

    it('rejects when the response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
      } as Response);

      const service = TestBed.inject(EmojiSourceService);
      await expect(service.fetchEmoji('1f600')).rejects.toThrow(/404/);
    });

    it('rejects when fetch throws a network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('network down'));

      const service = TestBed.inject(EmojiSourceService);
      await expect(service.fetchEmoji('1f600')).rejects.toThrow(/network down/);
    });
  });

  describe('fetchPlaceholderEmoji', () => {
    it('fetches the default grinning-face codepoint', async () => {
      const svg = '<svg>mock emoji</svg>';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(svg),
      } as Response);

      const service = TestBed.inject(EmojiSourceService);
      await expect(service.fetchPlaceholderEmoji()).resolves.toBe(svg);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u1f600.svg',
      );
    });
  });
});
