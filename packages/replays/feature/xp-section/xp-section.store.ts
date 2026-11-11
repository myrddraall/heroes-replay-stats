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
import type { Team } from '@myrddraall/heroprotocol-db';
import { ReplayStatsService } from '../../data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { XP_SOURCES, type XpChartKind, type XpSource } from '../../ui';
import { ReplayPageStore } from '../replay-page';

/**
 * {@link XpSection}'s component store: each team's XP over the replay its page shows, its timeline
 * for the advantage chart, the sources its chart counts (all of them to begin with) and the team
 * the sources chart shows (null: your team's).
 */
export const XpSectionStore = signalStore(
  withState<{ counted: readonly XpSource[]; team: Team | null }>({
    counted: XP_SOURCES.map((s) => s.id),
    team: null,
  }),
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    const chart = signal<Signal<XpChartKind> | null>(null);
    return {
      _chart: chart,
      _points: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.xpPoints(params),
      }),
      // only the advantage chart lists the game's turns
      _timeline: rxResource({
        params: () => (chart()?.() === 'advantage' ? (page.replayId() ?? undefined) : undefined),
        stream: ({ params }) => stats.timeline(params),
      }),
      /** The replay's players, in slot order. */
      players: computed(() => page.replay()?.players ?? []),
    };
  }),
  withComputed(({ _points, _timeline }) => ({
    /** Null until the XP has been read. */
    points: computed(() => (_points.hasValue() ? _points.value() : null)),
    /** Null until the timeline has been read, and for the charts without turns. */
    timeline: computed(() => (_timeline.hasValue() ? _timeline.value() : null)),
    error: computed(() => errorMessage(_points.error() ?? null)),
  })),
  withMethods((store) => ({
    /** Read what `chart` needs from now on. */
    show(chart: Signal<XpChartKind>): void {
      store._chart.set(chart);
    },
    count(counted: readonly XpSource[]): void {
      patchState(store, { counted });
    },
    showTeam(team: Team | null): void {
      patchState(store, { team });
    },
  })),
);
