import { statIcon, type StatColumn } from '../../model';

/** The score screen's columns, as the game's score screen has them, with its icons (heroes-assets' score-screen sheet). */
export const SCORE_COLUMNS: readonly StatColumn[] = [
  {
    id: 'SoloKill',
    label: 'Kills',
    description: 'Total hero kills',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#kills'),
  },
  {
    id: 'Assists',
    label: 'Assists',
    description: 'Total hero kill assists',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#assists'),
  },
  {
    id: 'Deaths',
    label: 'Deaths',
    description: 'Total deaths',
    format: 'integer',
    better: 'lower',
    icon: statIcon('score-screen#deaths'),
  },
  {
    id: 'SiegeDamage',
    label: 'Siege damage',
    description: 'Siege damage: damage dealt to enemy structures and minions',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#siege-damage'),
  },
  {
    id: 'HeroDamage',
    label: 'Hero damage',
    description: 'Hero damage: damage dealt to enemy heroes',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#hero-damage'),
  },
  {
    id: 'Healing',
    label: 'Healing',
    description: 'Healing and shielding: damage prevented and healing done to allied heroes',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#healing'),
  },
  {
    id: 'DamageTaken',
    label: 'Damage taken',
    description: 'Damage taken',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#damage-taken'),
  },
  {
    id: 'ExperienceContribution',
    label: 'Experience',
    description: 'Experience contributed',
    format: 'integer',
    better: 'higher',
    icon: statIcon('score-screen#experience'),
  },
];
