import { expect, test } from '@playwright/test';
import { resolveEmojiSvgUrl } from '../src/app/canvas/emoji-source.service';
import { EMOJI_CATALOG } from '../src/app/emoji-picker/emoji-catalog';

// Checks the real CDN serves what `resolveEmojiSvgUrl` points at. The app
// once tracked noto-emoji's `main` branch and every emoji silently 404'd
// after an upstream restructure; this fails loudly if paths stop resolving.
// Browser-independent, so it runs once rather than per browser project.

/** Requests in flight at once; firing the whole sample together gets connections reset. */
const CONCURRENCY = 8;

const ROUTING_CASES: [label: string, codepoints: string][] = [
  ['single codepoint (grinning face)', '1f600'],
  ['ZWJ sequence (family)', '1f468_200d_1f469_200d_1f467'],
  ['skin tone modifier', '1f44d_1f3fd'],
  ['keycap (zero-padded codepoint)', '0031_20e3'],
  ['flag ZWJ sequence (rainbow flag)', '1f3f3_200d_1f308'],
  ['regional-indicator flag (US)', '1f1fa_1f1f8'],
  ['subdivision tag-sequence flag (England)', '1f3f4_e0067_e0062_e0065_e006e_e0067_e007f'],
];

test.describe('emoji CDN', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'network-only check; run once');

  for (const [label, codepoints] of ROUTING_CASES) {
    test(`serves SVG for ${label}`, async ({ request }) => {
      const response = await request.get(resolveEmojiSvgUrl(codepoints));
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/svg+xml');
      expect(await response.text()).toContain('<svg');
    });
  }

  test('serves SVG for a sample spread across the whole catalog', async ({ request }) => {
    const stride = 20;
    const sample = EMOJI_CATALOG.filter((_, index) => index % stride === 0);
    const failures: string[] = [];
    for (let i = 0; i < sample.length; i += CONCURRENCY) {
      await Promise.all(
        sample.slice(i, i + CONCURRENCY).map(async (entry) => {
          const response = await request.get(resolveEmojiSvgUrl(entry.codepoints));
          if (response.status() !== 200) {
            failures.push(`${entry.emoji} (${entry.codepoints}): HTTP ${response.status()}`);
          }
        }),
      );
    }
    expect(failures, `${failures.length}/${sample.length} sampled emoji failed`).toEqual([]);
  });
});
