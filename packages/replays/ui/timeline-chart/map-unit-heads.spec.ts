import type { CampTypeInfo, MapUnitsInfo } from '@myrddraall/hero-data';
import { describe, expect, it } from 'vitest';
import type { CampState } from '../../model';
import { campKey, campRarityOf } from './map-unit-heads';

const campType = (
  id: string,
  category: CampTypeInfo['category'],
  defender: string,
  elite = false,
): CampTypeInfo => ({
  id,
  category,
  label: null,
  defenders: [{ unit: defender, count: 1 }],
  mercs: [],
  respawnSeconds: null,
  firstSpawnSeconds: null,
  elite,
  soloable: true,
  captureXp: null,
  defenderScaling: null,
  mercScaling: null,
  levels: [],
});
const units: MapUnitsInfo = {
  scalingTicks: { tickSeconds: 60, maxTicks: 60 },
  camps: [
    campType('SiegeCamp1', 'siege', 'OverwatchTurret'),
    campType('BruiserCamp1', 'bruiser', 'MercDefenderSentinel', true),
    campType('VisionMercCampBruiserCamp3', 'bruiser', 'MercDefenderHenchman1'),
  ],
  units: {},
  scaling: {},
};
const camp = (type: string | null, defender: string): CampState => ({
  id: 1,
  type,
  defenders: [defender],
  place: 'middle',
  side: null,
  spans: [],
});

describe('camp rarity and key', () => {
  it("raises an elite camp's rarity one level", () => {
    expect(campRarityOf(camp('Bruiser Camp', 'MercDefenderSentinel'), units)).toBe('legendary');
  });

  it("takes a camp never captured's kind from its camp type in the map's data", () => {
    expect(campRarityOf(camp(null, 'MercDefenderHenchman1'), units)).toBe('epic');
  });

  it('keys the rarities the camps have, by what each stands for', () => {
    expect(
      campKey(
        [
          camp('Siege Camp', 'OverwatchTurret'),
          camp('Bruiser Camp', 'MercDefenderSentinel'),
          camp(null, 'MercDefenderHenchman1'),
        ],
        units,
      ),
    ).toEqual([
      { theme: 'rare', label: 'Siege camp' },
      { theme: 'epic', label: 'Bruiser camp' },
      { theme: 'legendary', label: 'Elite bruiser camp' },
    ]);
  });
});
