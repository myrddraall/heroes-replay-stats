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
import type { HeroIcon } from '../../data/heroes/hero-lookup';
import { LatestHeroData } from '../../data/heroes/hero-data';
import { ReplayService } from '../../data/replays/replay.service';
import { ReplayStatsService } from '../../data/replays/replay-stats.service';
import { SettingsStore } from '../../data/settings/settings.store';
import { resolveYou } from '../../data/you/resolve-you';
import { errorMessage } from '../error-message';

/**
 * {@link ReplayPage}'s component store: the replay shown, who "you" are in it, and its stats
 * tables, which the page's sections (its child routes) read.
 */
export const ReplayPageStore = signalStore(
  withState({ replayId: null as string | null }),
  withProps(({ replayId }) => {
    const stats = inject(ReplayStatsService);
    const id = () => replayId() ?? undefined;
    return {
      _replays: inject(ReplayService),
      _settings: inject(SettingsStore),
      _heroData: inject(LatestHeroData),
      _scoreScreen: rxResource({
        params: id,
        stream: ({ params }) => stats.scoreScreen(params),
      }),
      _playerStats: rxResource({
        params: id,
        stream: ({ params }) => stats.playerStats(params),
      }),
    };
  }),
  withComputed(({ replayId, _replays, _settings, _heroData, _scoreScreen, _playerStats }) => {
    const replay = computed(() => _replays.replays().find((r) => r.id === replayId()) ?? null);
    return {
      /** Null until the list has loaded, and for a replay that is not stored (or not ready). */
      replay,
      /** False until the replay list has loaded. */
      loaded: _replays.loaded,
      you: computed(() => {
        const r = replay();
        return r ? resolveYou(r, new Set(_settings.meToonHandles())) : { slots: [], team: null };
      }),
      /** Each player's hero icon, by slot; `null` for a hero the data doesn't know. */
      icons: computed((): Readonly<Record<number, HeroIcon | null>> => {
        const heroes = _heroData.lookup();
        return Object.fromEntries(
          (replay()?.players ?? []).map((p) => [p.slot, heroes.heroIcon(p.heroId, p.hero)]),
        );
      }),
      scoreScreen: computed(() => (_scoreScreen.hasValue() ? _scoreScreen.value() : null)),
      playerStats: computed(() => (_playerStats.hasValue() ? _playerStats.value() : null)),
      error: computed(() =>
        errorMessage(_replays.error() ?? _scoreScreen.error() ?? _playerStats.error()),
      ),
    };
  }),
  withMethods((store) => ({
    /** Show the replay with this id, following it as it changes. */
    show: signalMethod<string>((replayId) => patchState(store, { replayId })),
  })),
);
