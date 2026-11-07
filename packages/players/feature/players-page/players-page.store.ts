import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { withQueryParams } from '@myrddraall/heroes-replay-stats-data-views/data';
import { ReplayImportJobStore } from '@myrddraall/heroes-replay-stats-import/data';
import { PlayerService } from '../../data';
import { nameFits } from '../../model';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { toPlayerRow } from '../../ui';

/**
 * {@link PlayersPage}'s component store: everyone in the stored replays, who is me, and the search
 * by name, kept in the page's address.
 */
export const PlayersPageStore = signalStore(
  withQueryParams({ q: '' }),
  withProps(() => ({
    _players: inject(PlayerService),
    _settings: inject(SettingsStore),
    _imports: inject(ReplayImportJobStore),
  })),
  withComputed(({ _players, _settings, query }) => {
    const all = computed(() => {
      const me = new Set(_settings.meToonHandles());
      return _players.players().map((p) => toPlayerRow(p, me));
    });
    return {
      /** Everyone, before searching. */
      all,
      search: computed(() => query().q),
      /** The players the search keeps. */
      rows: computed(() => {
        const search = query().q;
        return search.trim() ? all().filter((row) => nameFits(row.name, search)) : all();
      }),
      loaded: _players.loaded,
      error: computed(() => errorMessage(_players.error())),
    };
  }),
  withMethods(({ _settings, _imports, setQuery }) => ({
    /** Marks or unmarks an account as me. */
    setMe(id: string, isMe: boolean): void {
      _settings.setMe(id, isMe);
    },
    /** Opens the file picker to import replays. */
    importReplays(): void {
      void _imports.import();
    },
    /** Shows the players whose names fit this search. */
    setSearch(search: string): void {
      setQuery({ q: search });
    },
  })),
);
