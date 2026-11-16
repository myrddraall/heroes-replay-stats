import { computed, inject, type Signal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { ReplayStatsService } from '../../data';
import { ACTIVITY_COLUMN_IDS, type PlayerChartKind, STAT_COLUMNS } from '../../ui';
import { ReplayPageStore } from '../replay-page';

/** The stats a comparison can show: every player stat but the activity ones (APM has its own chart). */
const COMPARABLE = STAT_COLUMNS.filter((c) => !ACTIVITY_COLUMN_IDS.has(c.id));

/**
 * {@link PlayerChartSection}'s component store: the players and stats of the replay its page
 * shows, the stat compared (hero damage to begin with), and each player's commands per minute for
 * the APM chart and the players it hides (none to begin with).
 */
export const PlayerChartSectionStore = signalStore(
  withState<{ column: string; hidden: readonly number[] }>({
    column: 'HeroDamage',
    hidden: [],
  }),
  withProps(({ column }) => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    const chart = signal<Signal<PlayerChartKind> | null>(null);
    const actions = rxResource({
      // only the APM chart reads the replay's commands
      params: () => (chart()?.() === 'apm' ? (page.replayId() ?? undefined) : undefined),
      stream: ({ params }) => stats.actionsPerMinute(params),
    });
    return {
      _chart: chart,
      columns: COMPARABLE,
      /** The stat compared. */
      shownColumn: computed(() => COMPARABLE.find((c) => c.id === column()) ?? null),
      players: computed(() => page.replay()?.players ?? []),
      durationSeconds: computed(() => page.replay()?.durationSeconds ?? 0),
      /** Null until read. */
      stats: computed(() => page.playerStats()?.players ?? null),
      actions: computed(() => (actions.hasValue() ? actions.value() : null)),
    };
  }),
  withMethods((store) => ({
    /** Read what `chart` needs from now on. */
    show(chart: Signal<PlayerChartKind>): void {
      store._chart.set(chart);
    },
    choose(column: string | null): void {
      if (column) patchState(store, { column });
    },
    /** The players the APM chart hides, by slot. */
    hide(hidden: readonly number[]): void {
      patchState(store, { hidden });
    },
  })),
);
