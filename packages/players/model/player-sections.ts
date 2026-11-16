import {
  DEFAULT_PRESET,
  STAT_SECTIONS,
  type StatSectionId,
} from '@myrddraall/heroes-replay-stats-replays/model';
import { LENGTH_STAT_ID } from './player-aggregates';

/**
 * A player's stats sections, in the order their navigation lists them: a summary, then a match's
 * player stats sections but the connection (figures of the player, not of a hero or a map: they are
 * in the overview) and the activity (which is worked out only when a match's is opened).
 */
export const PLAYER_STAT_SECTION_IDS = [
  'summary',
  'pvp',
  'tanking',
  'pve',
  'cc',
  'healing',
] as const satisfies readonly ('summary' | StatSectionId)[];

export type PlayerStatSectionId = (typeof PLAYER_STAT_SECTION_IDS)[number];

export interface PlayerStatSection {
  readonly id: PlayerStatSectionId;
  readonly title: string;
  /** Its columns' ids, in order. */
  readonly columns: readonly string[];
}

const SUMMARY_COLUMNS = [
  'games',
  'wins',
  'losses',
  'winRate',
  'KDARatio',
  'Takedowns',
  'Kills',
  'Assists',
  'Deaths',
  'HeroDamage',
  'SiegeDamage',
  'Healing',
  'DamageTaken',
  'ExperienceContribution',
  LENGTH_STAT_ID,
];

/** A match's section as a player's: the matches and the share won, then the section's default columns. */
function fromMatchSection(id: StatSectionId): PlayerStatSection {
  const section = STAT_SECTIONS[id];
  return {
    id: id as PlayerStatSectionId,
    title: section.title,
    columns: [
      'games',
      'winRate',
      ...section.presets[DEFAULT_PRESET]!.filter((c) => c.shown).map((c) => c.id),
    ],
  };
}

export const PLAYER_STAT_SECTIONS: Readonly<Record<PlayerStatSectionId, PlayerStatSection>> = {
  summary: { id: 'summary', title: 'Summary', columns: SUMMARY_COLUMNS },
  pvp: fromMatchSection('pvp'),
  tanking: fromMatchSection('tanking'),
  pve: fromMatchSection('pve'),
  cc: fromMatchSection('cc'),
  healing: fromMatchSection('healing'),
};

/** The stats a player's records are kept for (their highest in one match), in order. */
export const RECORD_STATS: readonly string[] = [
  'Takedowns',
  'Kills',
  'Assists',
  'Deaths',
  'HighestKillStreak',
  'KDARatio',
  'HeroDamage',
  'SiegeDamage',
  'StructureDamage',
  'MinionDamage',
  'Healing',
  'SelfHealing',
  'ProtectionGivenToAllies',
  'DamageTaken',
  'DamageSoaked',
  'ExperienceContribution',
  'MercCampCaptures',
  'MinionsKilled',
  'RegenGlobesCollected',
  'TimeCCdEnemyHeroes',
  'TimeSpentDead',
  'OnFireTimeOnFire',
  LENGTH_STAT_ID,
];
