import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { ReplayImportJobStore } from '@myrddraall/heroes-replay-stats-import/data';
import { ReplayService, ViewedReplaysStore } from '../../data';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { toReplayCard } from '../../ui';

/** {@link ReplaysPage}'s component store: the stored replays as cards. */
export const ReplaysPageStore = signalStore(
  withProps(() => ({
    _replays: inject(ReplayService),
    _settings: inject(SettingsStore),
    _heroData: inject(LatestHeroData),
    _imports: inject(ReplayImportJobStore),
    _viewed: inject(ViewedReplaysStore),
  })),
  withComputed(({ _replays, _settings, _heroData, _viewed }) => ({
    cards: computed(() => {
      const me = new Set(_settings.meToonHandles());
      const heroes = _heroData.lookup();
      const seen = _viewed.seen();
      return _replays.replays().map((replay) => toReplayCard(replay, me, heroes, seen[replay.id]));
    }),
    outdated: _replays.outdated,
    loaded: _replays.loaded,
    error: computed(() => errorMessage(_replays.error())),
  })),
  withMethods(({ _imports }) => ({
    /** Opens the file picker to import replays. */
    importReplays(): void {
      void _imports.import();
    },
  })),
);
