import { describe, expect, it } from 'vitest';
import { isAsset, openKey, parseOpen, RANDOM_SETS } from './open-target';

describe('open-target', () => {
  it('reads what the URL opens, and writes it back the same', () => {
    expect(parseOpen('material:edgeLight222-korhal')).toEqual({
      kind: 'material',
      id: 'edgeLight222-korhal',
    });
    expect(openKey(parseOpen('scene:scene-1'))).toBe('scene:scene-1');
    expect(isAsset(parseOpen('planet:korhal'))).toBe(true);
  });

  it('opens the random sets for nothing, or what it cannot read', () => {
    expect(parseOpen(undefined)).toBe(RANDOM_SETS);
    expect(parseOpen('korhal')).toBe(RANDOM_SETS);
    expect(parseOpen('moon:x')).toBe(RANDOM_SETS);
    expect(isAsset(RANDOM_SETS)).toBe(false);
  });
});
