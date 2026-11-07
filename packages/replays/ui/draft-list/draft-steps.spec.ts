import type { DraftStepRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import type { HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { draftSteps } from './draft-steps';

describe('draft steps', () => {
  const heroes: HeroLookup = {
    heroIcon: (id) =>
      id === 'Barbarian' ? { picture: { src: 'sonya.png' }, name: 'Sonya' } : null,
    heroDataId: () => null,
    heroPortrait: () => null,
    award: () => null,
    mapPreview: () => null,
  };
  const step = (order: number, over: Partial<DraftStepRow>): DraftStepRow => ({
    order,
    type: 'ban',
    team: 0,
    heroId: 'Barbarian',
    gameloop: order,
    slot: null,
    name: null,
    hero: null,
    ...over,
  });

  it("names a ban's hero from the data, else by its id, and a pick's from the replay", () => {
    const steps = draftSteps(
      [
        step(1, {}),
        step(2, { heroId: 'Unknown', team: 1 }),
        step(3, { type: 'pick', heroId: 'Unknown', slot: 5, name: 'Bob', hero: 'Muradin' }),
      ],
      heroes,
      0,
      'relative',
    );
    expect(steps).toEqual([
      {
        key: 1,
        order: 1,
        action: 'Ban',
        team: 0,
        teamName: 'Blue team',
        hero: 'Sonya',
        icon: { picture: { src: 'sonya.png' }, name: 'Sonya' },
        player: null,
      },
      {
        key: 2,
        order: 2,
        action: 'Ban',
        team: 1,
        teamName: 'Red team',
        hero: 'Unknown',
        icon: null,
        player: null,
      },
      {
        key: 3,
        order: 3,
        action: 'Pick',
        team: 0,
        teamName: 'Blue team',
        hero: 'Muradin',
        icon: null,
        player: 'Bob',
      },
    ]);
  });
});
