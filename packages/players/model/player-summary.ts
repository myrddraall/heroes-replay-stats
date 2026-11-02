import type { PlayerRecord, ReplayRecord } from '@myrddraall/heroprotocol-db';

/** How often a player played one hero. */
export interface PlayerHero {
  readonly hero: string;
  readonly games: number;
}

/** One person across the stored replays, with their basic numbers. */
export interface PlayerSummary {
  /** The Battle.net account handle (`region-programId-realm-id`); `name:<name>` when the replay had none. */
  readonly id: string;
  /** The name from their most recent game. */
  readonly name: string;
  /** Battle.net region (1 NA, 2 EU, 3 KR, 5 CN), when known. */
  readonly region: number | null;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  /** wins / (wins + losses); null when no result is known. */
  readonly winRate: number | null;
  /** ISO-8601, UTC. */
  readonly lastPlayedAt: string;
  /** Most played first; ties by name. */
  readonly heroes: readonly PlayerHero[];
}

/** The rows a summary is made from. */
export interface PlayerRows {
  readonly replays: readonly Pick<ReplayRecord, 'id' | 'playedAt' | 'status'>[];
  readonly players: readonly PlayerRecord[];
}

export function playerId(p: Pick<PlayerRecord, 'toon' | 'name'>): string {
  return p.toon?.handle ?? `name:${p.name}`;
}

/** Group human players of available replays by account. Pure, for the service and tests. */
export function summarisePlayers(rows: PlayerRows): PlayerSummary[] {
  const playedAt = new Map<string, string>();
  for (const r of rows.replays)
    if (r.status === 'ready' || r.status === 'complete') playedAt.set(r.id, r.playedAt);

  const byId = new Map<string, { rows: PlayerRecord[]; latest: PlayerRecord; latestAt: string }>();
  for (const p of rows.players) {
    const at = playedAt.get(p.replayId);
    if (at === undefined || p.kind !== 'player') continue;
    const id = playerId(p);
    const entry = byId.get(id);
    if (!entry) byId.set(id, { rows: [p], latest: p, latestAt: at });
    else {
      entry.rows.push(p);
      if (at > entry.latestAt) Object.assign(entry, { latest: p, latestAt: at });
    }
  }

  const out: PlayerSummary[] = [];
  for (const [id, { rows: games, latest, latestAt }] of byId) {
    const wins = games.filter((g) => g.won === true).length;
    const losses = games.filter((g) => g.won === false).length;
    const heroCounts = new Map<string, number>();
    for (const g of games) heroCounts.set(g.hero, (heroCounts.get(g.hero) ?? 0) + 1);
    out.push({
      id,
      name: latest.name,
      region: latest.toon?.region ?? null,
      games: games.length,
      wins,
      losses,
      winRate: wins + losses === 0 ? null : wins / (wins + losses),
      lastPlayedAt: latestAt,
      heroes: [...heroCounts]
        .map(([hero, n]) => ({ hero, games: n }))
        .sort((a, b) => b.games - a.games || a.hero.localeCompare(b.hero)),
    });
  }
  return out.sort(
    (a, b) =>
      b.games - a.games ||
      b.lastPlayedAt.localeCompare(a.lastPlayedAt) ||
      a.name.localeCompare(b.name),
  );
}
