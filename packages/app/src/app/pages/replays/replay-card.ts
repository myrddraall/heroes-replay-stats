import type { HeroIcon, HeroLookup } from '../../data/heroes/hero-lookup';
import type { ReplaySummary } from '../../data/replays/replay.service';
import { resolveYou, type You } from '../../data/you/resolve-you';

/** One replay as the list shows it: the replay, who "you" are in it, and its pictures. */
export interface ReplayCard {
  readonly replay: ReplaySummary;
  readonly you: You;
  /** The map's replay preview, behind the card. */
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
    preview: heroes.mapPreview(replay.map),
    icons: Object.fromEntries(replay.players.map((p) => [p.slot, heroes.heroIcon(p.heroId)])),
  };
}
