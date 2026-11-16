import { computed, inject } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { StatSort } from '@myrddraall/heroes-replay-stats-replays/ui';
import { PLAYER_STAT_SECTIONS, type PlayerStatSectionId } from '../../model';
import { playerBreakdown, playerColumns } from '../../ui';
import { PlayerPageStore } from '../player-page';

/**
 * {@link StatsSection}'s component store: one stats section of the player its page shows, its
 * columns' figures for each group the page's choices split the matches into, and the table's order.
 */
export const StatsSectionStore = signalStore(
  withState({ section: 'summary' as PlayerStatSectionId, sort: null as StatSort | null }),
  withProps(() => ({ _player: inject(PlayerPageStore) })),
  withComputed(({ section, _player }) => {
    const columns = computed(() => playerColumns(PLAYER_STAT_SECTIONS[section()].columns));
    return {
      title: computed(() => PLAYER_STAT_SECTIONS[section()].title),
      groupBy: _player.groupBy,
      aggregate: _player.aggregate,
      /** The section's columns as shown and a row for each group, most matches first. */
      breakdown: computed(() => {
        const breakdown = playerBreakdown(
          _player.games(),
          _player.groupBy(),
          columns(),
          _player.aggregate(),
          _player.heroes(),
        );
        // stats none of these matches has (another map's, an older build's) are left out
        const shown = breakdown.columns.filter((c) =>
          breakdown.rows.some((r) => r.values[c.id] !== null),
        );
        return { ...breakdown, columns: shown };
      }),
    };
  }),
  withMethods((store) => ({
    /** Show this section, in the groups' own order. */
    show: signalMethod<PlayerStatSectionId>((section) => patchState(store, { section, sort: null })),
    setSort(sort: StatSort | null): void {
      patchState(store, { sort });
    },
    setGroupBy: store._player.setGroupBy,
    setAggregate: store._player.setAggregate,
  })),
);
