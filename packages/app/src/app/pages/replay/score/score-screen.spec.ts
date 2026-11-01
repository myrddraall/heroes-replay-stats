import { describe, expect, it } from 'vitest';
import { awardLabel } from './score-screen';

describe('awardLabel', () => {
  it('spells an award out, keeping its abbreviations', () => {
    expect(awardLabel('MVP')).toBe('MVP');
    expect(awardLabel('MostXPContribution')).toBe('Most XP contribution');
    expect(awardLabel('HighestKillStreak')).toBe('Highest kill streak');
    expect(awardLabel('MostAltarDamageDone')).toBe('Most altar damage done');
  });
});
