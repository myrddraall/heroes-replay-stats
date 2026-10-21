import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { PlayerService } from '../../data/players/player.service';
import { SettingsStore } from '../../data/settings/settings.store';
import { errorMessage } from '../error-message';
import { toPlayerRow } from './player-row';

/** {@link PlayersPage}'s component store: everyone in the stored replays, and who is me. */
export const PlayersPageStore = signalStore(
  withProps(() => ({
    _players: inject(PlayerService),
    _settings: inject(SettingsStore),
    _imports: inject(ReplayImportJobStore),
  })),
  withComputed(({ _players, _settings }) => ({
    rows: computed(() => {
      const me = new Set(_settings.meToonHandles());
      return _players.players().map((p) => toPlayerRow(p, me));
    }),
    loaded: _players.loaded,
    error: computed(() => errorMessage(_players.error())),
  })),
  withMethods(({ _settings, _imports }) => ({
    /** Marks or unmarks an account as me. */
    setMe(id: string, isMe: boolean): void {
      _settings.setMe(id, isMe);
    },
    /** Opens the file picker to import replays. */
    importReplays(): void {
      void _imports.import();
    },
  })),
);
