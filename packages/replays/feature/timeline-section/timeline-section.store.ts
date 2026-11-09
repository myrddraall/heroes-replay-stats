import { computed, inject, type Signal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayStatsService } from '../../data';
import type { TimelineChartKind, TimelineEventKind } from '../../ui';
import { ReplayPageStore } from '../replay-page';

/**
 * {@link TimelineSection}'s component store: the timeline and players of the replay its page shows;
 * for the timeline, camps and structures charts the map over the game; for the timeline, the
 * talents' names and the kinds of event hidden.
 */
export const TimelineSectionStore = signalStore(
  withState({ hiddenEvents: [] as readonly TimelineEventKind[] }),
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    const chart = signal<Signal<TimelineChartKind> | null>(null);
    return {
      _chart: chart,
      _page: page,
      // only the timeline, camps and structures charts read the map (the replay's stat events and
      // units)
      _map: rxResource({
        params: () => {
          const kind = chart()?.();
          return kind === 'timeline' || kind === 'camps' || kind === 'structures'
            ? (page.replayId() ?? undefined)
            : undefined;
        },
        stream: ({ params }) => stats.mapState(params),
      }),
      _timeline: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.timeline(params),
      }),
      /** The replay's players, in slot order. */
      players: computed(() => page.replay()?.players ?? []),
      /** The game's length on its clock. */
      durationSeconds: computed(() => page.replay()?.durationSeconds ?? 0),
      /** Each player's hero leaderboard portrait, by slot, for the timeline's row heads. */
      portraits: page.portraits,
      /** Your slots, whose rows are in your self theme. */
      you: computed(() => page.you().slots),
    };
  }),
  withComputed(({ _timeline, _map, _page }) => ({
    /** Null until the timeline has been read. */
    timeline: computed(() => (_timeline.hasValue() ? _timeline.value() : null)),
    /** Null until read, and for the charts other than the timeline, camps and structures. */
    map: computed(() => (_map.hasValue() ? _map.value() : null)),
    /** The names of the talents picked, by the game's id, from the replay's build's hero data. */
    talentNames: computed(() => {
      const data = _page.heroData();
      const events = _timeline.hasValue() ? _timeline.value().events : [];
      const names: Record<string, string> = {};
      for (const e of events) {
        const name = e.talent === null ? undefined : data?.talent(e.talent)?.name;
        if (name) names[e.talent!] = name;
      }
      return names;
    }),
    error: computed(() => errorMessage(_timeline.error() ?? null)),
  })),
  withMethods((store) => ({
    /** Read what `chart` needs from now on. */
    show(chart: Signal<TimelineChartKind>): void {
      store._chart.set(chart);
    },
    /** Show only the timeline's events not in `hidden`. */
    hideEvents(hidden: readonly TimelineEventKind[]): void {
      patchState(store, { hiddenEvents: hidden });
    },
  })),
);
