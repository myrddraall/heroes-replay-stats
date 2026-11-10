import type { Picture } from '@myrddraall/hero-data';
import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { StatColumn } from '@myrddraall/heroes-replay-stats-replays/model';
import {
  aggregateStat,
  awardCounts,
  groupGames,
  LENGTH_STAT_ID,
  winLoss,
  type PlayerGame,
} from '../../model';
import { averagedColumn, playerColumns } from '../player-columns';

/** One headline figure: a stat's column (its label and format), or a long stretch of time. */
export interface OverviewFigure {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  /** A stat's format, or `time`: seconds as hours and minutes. */
  readonly format: StatColumn['format'] | 'time';
  readonly digits?: StatColumn['digits'];
}

/** One of the player's most played heroes. */
export interface OverviewHero {
  readonly hero: string;
  readonly portrait: HeroIcon | null;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number | null;
}

/** An award the player got, and how often. */
export interface OverviewAward {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly badge: Picture | null;
  readonly count: number;
}

/** A player's matches at a glance. */
export interface PlayerOverviewModel {
  readonly games: number;
  /** About the matches: how many, the record, the time. */
  readonly matches: readonly OverviewFigure[];
  /** The player's average match. */
  readonly averages: readonly OverviewFigure[];
  /** Their connection over the matches: the drops, the returns and the time away. */
  readonly connection: readonly OverviewFigure[];
  /** The most played heroes, most played first. */
  readonly heroes: readonly OverviewHero[];
  /** How many more heroes they played. */
  readonly moreHeroes: number;
  /** MVP first, then the other awards, most often first. */
  readonly awards: readonly OverviewAward[];
  /** The latest matches' results, the most recent first: won, lost, or null without a result. */
  readonly recent: readonly (boolean | null)[];
}

/** The stats whose average a match the overview shows, in order. */
const AVERAGES = [
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
];
/** The connection stats the overview shows, each summed over the matches or averaged, in order. */
const CONNECTION = [
  ['Disconnects', 'total'],
  ['Reconnects', 'total'],
  ['TimeDisconnected', 'total'],
  ['PercentOfGameDisconnected', 'average'],
] as const;
/** How many heroes the overview names. */
const HEROES_SHOWN = 5;
/** How many of the latest results it shows. */
const RECENT_SHOWN = 20;
/** From this figure up an average is shown whole. */
const WHOLE_FROM = 100;

/** A player's overview over some matches (most recent first), with pictures from the hero data. */
export function toPlayerOverview(
  games: readonly PlayerGame[],
  heroes: HeroLookup,
): PlayerOverviewModel {
  const { wins, losses, winRate } = winLoss(games);
  const length = { id: LENGTH_STAT_ID, format: 'clock' } as const;
  const byHero = groupGames(games, 'hero');
  const mvps = games.filter((g) => g.mvp).length;
  const award = (id: string, count: number): OverviewAward => {
    const badges = heroes.award(id);
    return {
      id,
      name: badges?.name ?? id,
      description: badges?.description ?? null,
      badge: badges?.blue ?? badges?.red ?? null,
      count,
    };
  };
  return {
    games: games.length,
    matches: [
      { id: 'games', label: 'Matches', value: games.length, format: 'integer' },
      { id: 'wins', label: 'Wins', value: wins, format: 'integer' },
      { id: 'losses', label: 'Losses', value: losses, format: 'integer' },
      { id: 'winRate', label: 'Win Rate', value: winRate, format: 'percent', digits: [1, 1] },
      {
        id: 'time',
        label: 'Time Played',
        value: aggregateStat(games, length, 'total'),
        format: 'time',
      },
      {
        id: LENGTH_STAT_ID,
        label: 'Average Length',
        value: aggregateStat(games, length, 'average'),
        format: 'clock',
      },
    ],
    averages: playerColumns(AVERAGES).map((column) => {
      const value = aggregateStat(games, column, 'average');
      const shown = averagedColumn(column, Math.abs(value ?? 0) >= WHOLE_FROM);
      return { id: column.id, label: column.label, value, format: shown.format, digits: shown.digits };
    }),
    connection: CONNECTION.flatMap(([id, how]) =>
      playerColumns([id]).map((column) => ({
        id,
        label: column.label,
        value: aggregateStat(games, column, how),
        format: column.format,
        digits: column.digits,
      })),
    ),
    heroes: byHero.slice(0, HEROES_SHOWN).map((group) => {
      const first = group.games[0]!;
      return {
        hero: group.key,
        portrait: heroes.heroPortrait(first.heroId, first.hero),
        games: group.games.length,
        ...winLoss(group.games),
      };
    }),
    moreHeroes: Math.max(0, byHero.length - HEROES_SHOWN),
    awards: [
      ...(mvps > 0 ? [award('MVP', mvps)] : []),
      ...awardCounts(games).map((a) => award(a.award, a.count)),
    ],
    recent: games.slice(0, RECENT_SHOWN).map((g) => g.won),
  };
}
