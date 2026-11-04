import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { ReplayImportJobStore } from '@myrddraall/heroes-replay-stats-import/data';
import { ReplayService, ViewedReplaysStore } from '../../data';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { toReplayCard } from '../../ui';

/** {@link ReplaysPage}'s component store: the stored replays as cards, importing ones included. */
export const ReplaysPageStore = signalStore(
  withProps(() => ({
    _replays: inject(ReplayService),
    _settings: inject(SettingsStore),
    _heroData: inject(LatestHeroData),
    _imports: inject(ReplayImportJobStore),
    _viewed: inject(ViewedReplaysStore),
  })),
  withComputed(({ _replays, _settings, _heroData, _viewed, _imports }) => ({
    cards: computed(() => {
      const me = new Set(_settings.meToonHandles());
      const heroes = _heroData.lookup();
      const seen = _viewed.seen();
      const jobs = _imports.progressByReplay();
      return (
        _replays
          .listed()
          // one still importing only while its import runs: one that stopped part-way stays hidden
          .filter((r) => r.status === 'ready' || r.status === 'complete' || jobs.has(r.id))
          .map((r) => toReplayCard(r, me, heroes, seen[r.id], jobs.get(r.id) ?? null))
      );
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
