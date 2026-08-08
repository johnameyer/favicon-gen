import { EMOJI_CATALOG } from './emoji-catalog';

describe('EMOJI_CATALOG', () => {
  it('excludes the Flags group', () => {
    expect(EMOJI_CATALOG.some((entry) => entry.group === 'Flags')).toBe(false);
  });

  it('has a reasonable number of entries', () => {
    expect(EMOJI_CATALOG.length).toBeGreaterThan(1000);
  });

  it('has entries with the expected shape', () => {
    const grinningFace = EMOJI_CATALOG.find((entry) => entry.slug === 'grinning_face');
    expect(grinningFace).toEqual({
      emoji: '😀',
      name: 'grinning face',
      slug: 'grinning_face',
      group: 'Smileys & Emotion',
      codepoints: '1f600',
    });
  });

  it('computes multi-codepoint codepoints for ZWJ sequence entries', () => {
    const family = EMOJI_CATALOG.find((entry) => entry.slug === 'family_man_woman_girl');
    expect(family?.codepoints).toBe('1f468_200d_1f469_200d_1f467');
  });
});
