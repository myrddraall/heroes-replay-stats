import { describe, expect, it } from 'vitest';
import { originsOf } from './setting-origins';

describe('settings’ origins', () => {
  it('say which level sets each setting: the last that does', () => {
    expect(
      originsOf<'strength' | 'glow' | 'scale'>([
        ['its tuning', { strength: 0.5, glow: 2 }],
        ['the library (material)', undefined],
        ['the library (planet)', { glow: 1, scale: undefined }],
      ]),
    ).toEqual({ strength: 'its tuning', glow: 'the library (planet)' });
  });
});
