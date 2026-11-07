import type { Picture } from '@myrddraall/hero-data';
import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { replayViewed, type ReplaySummary, type ReplayViewed } from '../../model';
import { resolveYou, type You } from '@myrddraall/heroes-replay-stats-players/model';

/**
 * What is happening to a replay: `importing` until it can be opened, then `analysing` while its
 * background analysers run.
 */
export type ReplayActivity = 'importing' | 'analysing';

/** A replay's import job while it runs: its stage and progress, 0..1. */
export interface ReplayCardJob {
  readonly stage: ReplayActivity;
  readonly progress: number;
}

/**
 * One replay as the list shows it: the replay, who "you" are in it, whether you have looked at it,
 * what is happening to it, and its pictures.
 */
export interface ReplayCard {
  readonly replay: ReplaySummary;
  readonly you: You;
  readonly viewed: ReplayViewed;
  /** What is happening to it now; null once it is fully analysed. It opens unless `importing`. */
  readonly activity: ReplayActivity | null;
  /** Its import job's progress (0..1) while the job runs; null without one. */
  readonly progress: number | null;
  /** The map's replay preview, behind the card: a file, or its place in the sheet of every map's. */
  readonly preview: Picture | null;
  /** Each player's hero icon, by slot; `null` for a hero the data doesn't know. */
  readonly icons: Readonly<Record<number, HeroIcon | null>>;
}

/** Without a job (a stored status from an earlier import), what the replay's status says. */
const ACTIVITY_OF_STATUS: Readonly<Record<ReplaySummary['status'], ReplayActivity | null>> = {
  ingesting: 'importing',
  analysing: 'importing',
  ready: 'analysing',
  complete: null,
};

/**
 * A replay's card, for the accounts marked as me (toon handles), the hero data, the import of it
 * you last opened (`undefined` when you never opened it), and its import job while that runs.
 */
export function toReplayCard(
  replay: ReplaySummary,
  me: ReadonlySet<string>,
  heroes: HeroLookup,
  seenImport: string | undefined,
  job: ReplayCardJob | null = null,
): ReplayCard {
  return {
    replay,
    you: resolveYou(replay, me),
    viewed: replayViewed(replay.importedAt, seenImport),
    activity: job?.stage ?? ACTIVITY_OF_STATUS[replay.status],
    progress: job?.progress ?? null,
    preview: heroes.mapPreview(replay.map),
    icons: Object.fromEntries(
      replay.players.map((p) => [p.slot, heroes.heroIcon(p.heroId, p.hero)]),
    ),
  };
}
