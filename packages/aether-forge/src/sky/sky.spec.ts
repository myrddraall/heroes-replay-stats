import { describe, expect, it } from 'vitest';
import { skyAnchorView } from './sky';
describe('the sky’s anchor as its panel shows it', () => {
  it('is the world where no level sets it', () => {
    expect(skyAnchorView(undefined, undefined)).toEqual({ value: 'world' });
    expect(skyAnchorView({}, {})).toEqual({ value: 'world' });
  });

  it('is the level edited’s, over the one under it (named where it sets it)', () => {
    expect(skyAnchorView({ anchor: 'camera' }, {})).toEqual({
      value: 'camera',
      origin: 'the library (sky)',
    });
    expect(skyAnchorView({ anchor: 'camera' }, { anchor: 'position' })).toEqual({
      value: 'position',
      set: 'position',
      origin: 'the library (sky)',
    });
    expect(skyAnchorView(undefined, { anchor: 'world' })).toEqual({ value: 'world', set: 'world' });
  });
});
