import type { Team } from '@myrddraall/heroprotocol-db';

/** Who "you" are in one replay. */
export interface You {
  /** Your players' slots; more than one only when several "me" accounts played. */
  readonly slots: readonly number[];
  /** Your team; null when there is no "you", or your accounts played on both teams. */
  readonly team: Team | null;
}

interface Player {
  readonly slot: number;
  readonly toonHandle: string | null;
  readonly team: Team | null;
}

const NOBODY: You = { slots: [], team: null };

function asYou(players: readonly Player[]): You {
  const teams = new Set(players.map((p) => p.team));
  const [team] = teams;
  return { slots: players.map((p) => p.slot), team: teams.size === 1 ? (team ?? null) : null };
}

/**
 * "You" in a replay, from the accounts marked as me (`me`, toon handles) and the account
 * that recorded it:
 * 1. the recorder, if it is one of yours — this also settles two of yours in one game;
 * 2. otherwise your accounts that played, if any;
 * 3. otherwise (nothing marked as me, or none of yours played) the recorder.
 */
export function resolveYou(
  replay: { readonly players: readonly Player[]; readonly recorderToonHandle: string | null },
  me: ReadonlySet<string>,
): You {
  const handle = replay.recorderToonHandle;
  const recorder =
    handle === null ? undefined : replay.players.find((p) => p.toonHandle === handle);
  if (recorder && me.has(recorder.toonHandle!)) return asYou([recorder]);
  const mine = replay.players.filter((p) => p.toonHandle !== null && me.has(p.toonHandle));
  if (mine.length > 0) return asYou(mine);
  return recorder ? asYou([recorder]) : NOBODY;
}
