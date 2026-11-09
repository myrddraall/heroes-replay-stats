import { computed, inject, type Signal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayStatsService } from '../../data';
import type { TimelineChartKind } from '../../ui';
import { ReplayPageStore } from '../replay-page';

/**
 * {@link TimelineSection}'s component store: the timeline and players of the replay its page shows,
 * and for the camps and structures charts the map over the game.
 */
export const TimelineSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    const chart = signal<Signal<TimelineChartKind> | null>(null);
    return {
      _chart: chart,
      // only the camps and structures charts read the map (the replay's stat events and units)
      _map: rxResource({
        params: () => {
          const kind = chart()?.();
          return kind === 'camps' || kind === 'structures'
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
    };
  }),
  withComputed(({ _timeline, _map }) => ({
    /** Null until the timeline has been read. */
    timeline: computed(() => (_timeline.hasValue() ? _timeline.value() : null)),
    /** Null until read, and for the charts other than the camps' and structures'. */
    map: computed(() => (_map.hasValue() ? _map.value() : null)),
    error: computed(() => errorMessage(_timeline.error() ?? null)),
  })),
  withMethods((store) => ({
    /** Read what `chart` needs from now on. */
    show(chart: Signal<TimelineChartKind>): void {
      store._chart.set(chart);
    },
  })),
);
