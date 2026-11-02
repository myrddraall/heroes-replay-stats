import { ACTIVITY_COLUMN_IDS } from './stat-columns';

/**
 * Each player's row with their activity stats (the columns read from the `activity` table) added,
 * matched by slot; a player with no activity row is left as is.
 */
export function withActivity<P extends { readonly slot: number }>(
  players: readonly P[],
  activity: readonly (object & { readonly slot: number })[],
): P[] {
  const bySlot = new Map(activity.map((row) => [row.slot, row]));
  return players.map((player) => {
    const row = bySlot.get(player.slot) as Readonly<Record<string, unknown>> | undefined;
    if (!row) return player;
    const stats = Object.fromEntries(
      Object.entries(row).filter(([key]) => ACTIVITY_COLUMN_IDS.has(key)),
    );
    return { ...player, ...stats };
  });
}
