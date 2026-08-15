import { EMOJI_CATALOG } from './emoji-catalog';

describe('EMOJI_CATALOG', () => {
  it('has a reasonable number of entries', () => {
    expect(EMOJI_CATALOG.length).toBeGreaterThan(1000);
  });

  it('has entries with the expected shape', () => {
    const grinningFace = EMOJI_CATALOG.find((entry) => entry.emoji === '😀');
    expect(grinningFace?.codepoints).toBe('1f600');
    expect(grinningFace?.keywords).toContain('grinning_face');
    expect(grinningFace?.keywords).toContain('smile');
  });

  it('computes multi-codepoint codepoints for ZWJ sequence entries', () => {
    const family = EMOJI_CATALOG.find((entry) => entry.keywords.includes('family_man_woman_girl'));
    expect(family?.codepoints).toBe('1f468_200d_1f469_200d_1f467');
  });

  it('does not exclude flag emoji', () => {
    const usFlag = EMOJI_CATALOG.find((entry) => entry.emoji === '🇺🇸');
    expect(usFlag).toBeDefined();
    expect(usFlag?.keywords).toContain('us');
  });

  it('finds car-related emoji via keyword search, not just substring-on-name matching', () => {
    const matches = EMOJI_CATALOG.filter((entry) =>
      entry.keywords.some((keyword) => keyword.toLowerCase().includes('car')),
    ).map((entry) => entry.emoji);

    expect(matches).toContain('🚗');
    expect(matches).toContain('🚙');
    expect(matches).toContain('🚕');
  });
});
