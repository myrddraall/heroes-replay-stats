import type { StatColumn } from '@myrddraall/heroes-replay-stats-ui';

/** The score screen's columns, as the game's score screen has them. */
export const SCORE_COLUMNS: readonly StatColumn[] = [
  {
    id: 'SoloKill',
    label: 'Kills',
    description: 'Total hero kills',
    format: 'integer',
    better: 'higher',
    icon: 'swords',
  },
  {
    id: 'Assists',
    label: 'Assists',
    description: 'Total hero kill assists',
    format: 'integer',
    better: 'higher',
    icon: 'handshake',
  },
  {
    id: 'Deaths',
    label: 'Deaths',
    description: 'Total deaths',
    format: 'integer',
    better: 'lower',
    icon: 'skull',
  },
  {
    id: 'SiegeDamage',
    label: 'Siege damage',
    description: 'Siege damage: damage dealt to enemy structures and minions',
    format: 'integer',
    better: 'higher',
    icon: 'castle',
  },
  {
    id: 'HeroDamage',
    label: 'Hero damage',
    description: 'Hero damage: damage dealt to enemy heroes',
    format: 'integer',
    better: 'higher',
    icon: 'local_fire_department',
  },
  {
    id: 'Healing',
    label: 'Healing',
    description: 'Healing and shielding: damage prevented and healing done to allied heroes',
    format: 'integer',
    better: 'higher',
    icon: 'healing',
  },
  {
    id: 'DamageTaken',
    label: 'Damage taken',
    description: 'Damage taken',
    format: 'integer',
    better: 'higher',
    icon: 'shield',
  },
  {
    id: 'ExperienceContribution',
    label: 'Experience',
    description: 'Experience contributed',
    format: 'integer',
    better: 'higher',
    icon: 'star',
  },
];
