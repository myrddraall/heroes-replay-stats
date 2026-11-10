import { describe, expect, it } from 'vitest';
import { hasDraft } from './game-mode';

describe('hasDraft', () => {
  it('is true for the drafted modes only', () => {
    expect(hasDraft('storm-league')).toBe(true);
    expect(hasDraft('unranked-draft')).toBe(true);
    expect(hasDraft('custom-draft')).toBe(true);
    expect(hasDraft('quick-match')).toBe(false);
    expect(hasDraft('aram')).toBe(false);
    expect(hasDraft('custom')).toBe(false);
  });
});
