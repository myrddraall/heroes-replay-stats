import type { Picture } from '@myrddraall/hero-data';
import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { replayViewed, type ReplaySummary, type ReplayViewed } from '../../model';
import { resolveYou, type You } from '@myrddraall/heroes-replay-stats-players/model';

/**
 * One replay as the list shows it: the replay, who "you" are in it, whether you have looked at it,
 * and its pictures.
 */
export interface ReplayCard {
  readonly replay: ReplaySummary;
  readonly you: You;
  readonly viewed: ReplayViewed;
  /** The map's replay preview, behind the card: a file, or its place in the sheet of every map's. */
  readonly preview: Picture | null;
  /** Each player's hero icon, by slot; `null` for a hero the data doesn't know. */
  readonly icons: Readonly<Record<number, HeroIcon | null>>;
}

/**
 * A replay's card, for the accounts marked as me (toon handles), the hero data, and the import of
 * it you last opened (`undefined` when you never opened it).
 */
export function toReplayCard(
  replay: ReplaySummary,
  me: ReadonlySet<string>,
  heroes: HeroLookup,
  seenImport: string | undefined,
): ReplayCard {
  return {
    replay,
    you: resolveYou(replay, me),
    viewed: replayViewed(replay.importedAt, seenImport),
    preview: heroes.mapPreview(replay.map),
    icons: Object.fromEntries(
      replay.players.map((p) => [p.slot, heroes.heroIcon(p.heroId, p.hero)]),
    ),
  };
}
