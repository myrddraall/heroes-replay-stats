import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { ReplaySummary } from '../../model';
import { resolveYou, type You } from '@myrddraall/heroes-replay-stats-players/model';

/** One replay as the list shows it: the replay, who "you" are in it, and its pictures. */
export interface ReplayCard {
  readonly replay: ReplaySummary;
  readonly you: You;
  /** The map's replay preview (always a file of its own), behind the card. */
  readonly preview: string | null;
  /** Each player's hero icon, by slot; `null` for a hero the data doesn't know. */
  readonly icons: Readonly<Record<number, HeroIcon | null>>;
}

/** A replay's card, for the accounts marked as me (toon handles) and the hero data. */
export function toReplayCard(
  replay: ReplaySummary,
  me: ReadonlySet<string>,
  heroes: HeroLookup,
): ReplayCard {
  return {
    replay,
    you: resolveYou(replay, me),
    preview: heroes.mapPreview(replay.map)?.src ?? null,
    icons: Object.fromEntries(
      replay.players.map((p) => [p.slot, heroes.heroIcon(p.heroId, p.hero)]),
    ),
  };
}
