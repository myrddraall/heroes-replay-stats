import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { ReplayService } from '@myrddraall/heroes-replay-stats-replays/data';
import {
  ANY_MATCH,
  filterMatches,
  matchOptions,
  type MatchFilter,
} from '@myrddraall/heroes-replay-stats-replays/model';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { PlayerGamesService, PlayerService } from '../../data';
import { NO_PLAYER_GAMES, playerGames, type Aggregate, type GroupBy } from '../../model';
import { toPlayerRow } from '../../ui';

/**
 * {@link PlayerPage}'s component store: the player shown, their matches across the stored replays,
 * and the choices every section of the page shares: the filter that narrows the matches, what the
 * stats tables split them by and how each group's matches become one figure. The page's sections
 * (its child routes) read the matches from it.
 */
export const PlayerPageStore = signalStore(
  withState({
    playerId: null as string | null,
    filter: ANY_MATCH as MatchFilter,
    groupBy: 'hero' as GroupBy,
    aggregate: 'average' as Aggregate,
  }),
  withProps(({ playerId }) => {
    const games = inject(PlayerGamesService);
    return {
      _players: inject(PlayerService),
      _replays: inject(ReplayService),
      _settings: inject(SettingsStore),
      _heroData: inject(LatestHeroData),
      _rows: rxResource({
        params: () => playerId() ?? undefined,
        stream: ({ params }) => games.games(params),
      }),
    };
  }),
  withComputed(({ playerId, filter, _players, _replays, _settings, _heroData, _rows }) => {
    /** Every match of theirs, most recently played first. */
    const all = computed(() =>
      playerGames(_rows.hasValue() ? _rows.value() : NO_PLAYER_GAMES, _replays.replays()),
    );
    return {
      /** False until the players, the replays and this player's rows have been read. */
      loaded: computed(() => _players.loaded() && _replays.loaded() && _rows.hasValue()),
      error: computed(() => errorMessage(_players.error() ?? _replays.error() ?? _rows.error())),
      /** The player as the players table has them; null for nobody by that id. */
      player: computed(() => {
        const summary = _players.players().find((p) => p.id === playerId());
        return summary ? toPlayerRow(summary, new Set(_settings.meToonHandles())) : null;
      }),
      /** Every match of theirs, before filtering. */
      all,
      /** What the filter can choose from. */
      options: computed(() => matchOptions(all())),
      /** The matches the filter keeps: what every section shows. */
      games: computed(() => filterMatches(all(), filter(), new Date())),
      /** Heroes' pictures and awards' badges, from the newest build's data. */
      heroes: _heroData.lookup,
    };
  }),
  withMethods((store) => ({
    /** Show the player with this id, every match of theirs. */
    show: signalMethod<string>((playerId) => patchState(store, { playerId, filter: ANY_MATCH })),
    /** Narrow the matches every section shows. */
    setFilter(filter: MatchFilter = ANY_MATCH): void {
      patchState(store, { filter });
    },
    /** Split the stats tables' matches by this. */
    setGroupBy(groupBy: GroupBy): void {
      patchState(store, { groupBy });
    },
    /** Make each group's matches one figure this way. */
    setAggregate(aggregate: Aggregate): void {
      patchState(store, { aggregate });
    },
  })),
);
