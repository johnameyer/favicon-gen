import { TestBed } from '@angular/core/testing';
import { EmojiSourceService } from './emoji-source.service';

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

  it('resolves with SVG text on a successful fetch', async () => {
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

  it('rejects when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(''),
    } as Response);

    const service = TestBed.inject(EmojiSourceService);
    await expect(service.fetchPlaceholderEmoji()).rejects.toThrow(/404/);
  });

  it('rejects when fetch throws a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('network down'));

    const service = TestBed.inject(EmojiSourceService);
    await expect(service.fetchPlaceholderEmoji()).rejects.toThrow(/network down/);
  });
});
