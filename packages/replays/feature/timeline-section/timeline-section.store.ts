import { computed, inject, resource, type Signal, signal } from '@angular/core';
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
import { HERO_DATA } from '@myrddraall/heroes-replay-stats-heroes/data';
import { ReplayStatsService } from '../../data';
import type { TimelineChartKind, TimelineEventKind } from '../../ui';
import { ReplayPageStore } from '../replay-page';

/**
 * {@link TimelineSection}'s component store: the timeline and players of the replay its page shows;
 * for the timeline, camps and structures charts the map over the game; for the timeline, the
 * talents' names and the kinds of event hidden; for the camps and structures, the map's camps and
 * unit cards (heroes-assets, through the hero data).
 */
export const TimelineSectionStore = signalStore(
  withState({ hiddenEvents: [] as readonly TimelineEventKind[] }),
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    const provider = inject(HERO_DATA);
    const chart = signal<Signal<TimelineChartKind> | null>(null);
    // only the timeline, camps and structures charts read the map
    const readsMap = () => {
      const kind = chart()?.();
      return kind === 'timeline' || kind === 'camps' || kind === 'structures';
    };
    // the map's camps and unit cards (heroes-assets): which units defend its camps, and the camps'
    // and structures' row heads
    const mapUnits = resource({
      params: () => {
        const map = page.replay()?.map;
        return readsMap() && map ? map : undefined;
      },
      loader: ({ params }) => provider.mapUnits?.(params) ?? Promise.resolve(null),
    });
    return {
      _chart: chart,
      _page: page,
      // the map over the game (the replay's stat events and units), once its game data is read: its
      // camps' defenders are the units that data names (none read, the ones named for defending)
      _map: rxResource({
        params: () => {
          const replayId = page.replayId();
          if (!readsMap() || !replayId || !page.replay() || mapUnits.isLoading()) return undefined;
          const units = mapUnits.hasValue() ? mapUnits.value() : null;
          const defenders = units
            ? new Set(units.camps.flatMap((c) => c.defenders.map((d) => d.unit)))
            : null;
          return { replayId, defenders };
        },
        stream: ({ params }) => stats.mapState(params.replayId, params.defenders),
      }),
      _mapUnits: mapUnits,
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
  withComputed(({ _timeline, _map, _page, _mapUnits }) => ({
    /** The map's camps and unit cards; null until read, for the other charts, and for a map without them. */
    mapUnits: computed(() => (_mapUnits.hasValue() ? (_mapUnits.value() ?? null) : null)),
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
