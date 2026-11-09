import { describe, expect, it } from 'vitest';
import { campRarity } from './map-names';

describe('camp rarity', () => {
  it("follows the camp's type: siege rare, bruiser epic, boss legendary", () => {
    expect(['Siege Camp', 'Bruiser Camp', 'Boss Camp', null].map((t) => campRarity(t))).toEqual([
      'rare',
      'epic',
      'legendary',
      null,
    ]);
  });

  it('is one higher for an elite camp, legendary at most', () => {
    expect(['Siege Camp', 'Bruiser Camp', 'Boss Camp'].map((t) => campRarity(t, true))).toEqual([
      'epic',
      'legendary',
      'legendary',
    ]);
  });
});
