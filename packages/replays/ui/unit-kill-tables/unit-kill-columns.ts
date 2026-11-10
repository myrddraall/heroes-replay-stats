import type { StatColumn } from '../../model';

const killingBlows = 'Only killing blows count.';

/** The unit kills tables' columns, by the `unitKills` analyser's counts; more is better. */
export const UNIT_KILL_COLUMNS: readonly StatColumn[] = (
  [
  {
    id: 'heroes',
    label: 'Heroes',
    format: 'integer',
    description:
      `Heroes killed, each time the game recorded a death. ${killingBlows} ` +
      "The score screen counts some heroes' deaths as less (Murky's, and each of The Lost " +
      "Vikings'), so this can be higher than its Kills.",
  },
  {
    id: 'heroUnits',
    label: 'Hero Units',
    format: 'integer',
    description:
      "Other hero units killed without their player dying, such as D.Va's mech, Abathur's " +
      `clones and Chen's spirits. Not kills on the score screen. ${killingBlows}`,
  },
  { id: 'minions', label: 'Minions', format: 'integer' },
  {
    id: 'mercsCamp',
    label: 'Mercs at Camps',
    format: 'integer',
    description: `Mercenaries killed at their camps. ${killingBlows}`,
  },
  {
    id: 'mercsLane',
    label: 'Mercs in Lane',
    format: 'integer',
    description: `Mercenaries killed in lane. ${killingBlows}`,
  },
  {
    id: 'bossCamp',
    label: 'Bosses at Camps',
    format: 'integer',
    description: `Bosses killed at their camps. ${killingBlows}`,
  },
  {
    id: 'bossLane',
    label: 'Bosses in Lane',
    format: 'integer',
    description: `Bosses killed in lane. ${killingBlows}`,
  },
  { id: 'structures', label: 'Structures', format: 'integer' },
  {
    id: 'summons',
    label: 'Summons',
    format: 'integer',
    description: 'Units heroes summon, such as pets and turrets.',
  },
  { id: 'other', label: 'Other', format: 'integer' },
  { id: 'total', label: 'Total', format: 'integer' },
] satisfies StatColumn[]
).map((column): StatColumn => ({ ...column, better: 'higher' }));
