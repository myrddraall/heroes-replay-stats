import type { StatColumn } from '../../model';

const killingBlows = 'Only killing blows count.';

/** The unit kills tables' columns, by the `unitKills` analyser's counts. */
export const UNIT_KILL_COLUMNS: readonly StatColumn[] = [
  { id: 'heroes', label: 'Heroes', format: 'integer' },
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
];
