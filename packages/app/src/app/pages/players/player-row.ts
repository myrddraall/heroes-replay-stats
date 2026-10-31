import type { PlayerSummary } from '../../data/players/player.service';

const REGIONS: Readonly<Record<number, string>> = { 1: 'NA', 2: 'EU', 3: 'KR', 5: 'CN' };
/** How many of a player's heroes the list names; the rest are counted. */
const HEROES_SHOWN = 3;

/** One player as the table shows them. */
export interface PlayerRow {
  readonly id: string;
  readonly name: string;
  /** `NA`, `EU`, `KR`, `CN`; `null` if unknown. */
  readonly region: string | null;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number | null;
  readonly lastPlayedAt: string;
  /** The heroes the table names, most played first. */
  readonly topHeroes: PlayerSummary['heroes'];
  /** How many more heroes they played. */
  readonly moreHeroes: number;
  /** Only accounts with a toon handle can be marked as me; `name:` ids are not accounts. */
  readonly canBeMe: boolean;
  readonly isMe: boolean;
}

/** A player's row, for the accounts marked as me (toon handles). */
export function toPlayerRow(p: PlayerSummary, me: ReadonlySet<string>): PlayerRow {
  return {
    id: p.id,
    name: p.name,
    region: p.region === null ? null : (REGIONS[p.region] ?? null),
    games: p.games,
    wins: p.wins,
    losses: p.losses,
    winRate: p.winRate,
    lastPlayedAt: p.lastPlayedAt,
    topHeroes: p.heroes.slice(0, HEROES_SHOWN),
    moreHeroes: Math.max(0, p.heroes.length - HEROES_SHOWN),
    canBeMe: !p.id.startsWith('name:'),
    isMe: me.has(p.id),
  };
}
