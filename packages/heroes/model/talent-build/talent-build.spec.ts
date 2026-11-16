import { describe, expect, it } from 'vitest';
import { talentBuildLink } from './talent-build';

describe('talentBuildLink', () => {
  it("writes the game's chat link: each tier's place, 0 for a tier not chosen, then the hero's id", () => {
    expect(talentBuildLink('Lucio', [1, 2, 3, 1, 2, 3, 1])).toBe('[T1231231,Lucio]');
    expect(talentBuildLink('DemonHunter', [1, 3, 2, 2, null, null, null])).toBe('[T1322000,DemonHunter]');
  });
});
