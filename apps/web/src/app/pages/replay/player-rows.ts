import type { StatColumn, StatRow } from '@myrddraall/heroes-replay-stats-ui';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon } from '../../data/heroes/hero-lookup';
import { teamColor, type TeamColorMode } from '../../team/team-color';

/** Who a player is, as a stats table's row identifies them. */
export interface PlayerIdentity {
  readonly slot: number;
  readonly name: string;
  readonly hero: string;
  readonly team: Team | null;
}

/** A stats table's row for one player: the player's row from the replay and their hero icon. */
export interface PlayerRowData<P extends PlayerIdentity> {
  readonly player: P;
  readonly icon: HeroIcon | null;
}

/** The columns' stats from a player's row: its numbers, null for anything else. */
export function statValues(
  row: object,
  columns: readonly StatColumn[],
): Readonly<Record<string, number | null>> {
  const values = row as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    columns.map((c) => {
      const v = values[c.id];
      return [c.id, typeof v === 'number' ? v : null];
    }),
  );
}

/**
 * One stats row per player, grouped by team and themed in its colour from your point of view,
 * your team first, then by slot, with the columns' stats.
 */
export function playerRows<P extends PlayerIdentity>(
  players: readonly P[],
  icons: Readonly<Record<number, HeroIcon | null>>,
  columns: readonly StatColumn[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): StatRow<PlayerRowData<P>>[] {
  const color = (team: Team | null) => (team === null ? null : teamColor(team, yourTeam, mode));
  return players
    .map((player) => {
      const c = color(player.team);
      return {
        key: player.slot,
        group: player.team,
        values: statValues(player, columns),
        class: c === null ? undefined : `hrs-glass-${c}`,
        data: { player, icon: icons[player.slot] ?? null },
      };
    })
    .sort(
      (a, b) =>
        Number(a.class !== 'hrs-glass-blue') - Number(b.class !== 'hrs-glass-blue') ||
        a.key - b.key,
    );
}
