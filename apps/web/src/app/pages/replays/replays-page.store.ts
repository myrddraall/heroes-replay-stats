import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { ReplayService } from '../../data/replays/replay.service';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { toReplayCard } from './replay-card';

/** {@link ReplaysPage}'s component store: the stored replays as cards. */
export const ReplaysPageStore = signalStore(
  withProps(() => ({
    _replays: inject(ReplayService),
    _settings: inject(SettingsStore),
    _heroData: inject(LatestHeroData),
    _imports: inject(ReplayImportJobStore),
  })),
  withComputed(({ _replays, _settings, _heroData }) => ({
    cards: computed(() => {
      const me = new Set(_settings.meToonHandles());
      const heroes = _heroData.lookup();
      return _replays.replays().map((replay) => toReplayCard(replay, me, heroes));
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
