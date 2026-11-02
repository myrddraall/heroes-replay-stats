import { describe, expect, it } from 'vitest';
import { teamColor } from './team-color';

describe('teamColor', () => {
  it('makes your team blue when relative, and falls back to fixed without a "you"', () => {
    expect(teamColor(1, 1, 'relative')).toBe('blue');
    expect(teamColor(0, 1, 'relative')).toBe('red');
    expect(teamColor(0, null, 'relative')).toBe('blue');
    expect(teamColor(1, null, 'relative')).toBe('red');
  });

  it('makes the first team blue when fixed, whoever you are', () => {
    expect(teamColor(0, 1, 'fixed')).toBe('blue');
    expect(teamColor(1, 1, 'fixed')).toBe('red');
  });
});
