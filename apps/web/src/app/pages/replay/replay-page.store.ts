import { computed, inject, resource } from '@angular/core';
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
import { heroesImages } from '@myrddraall/hero-data';
import { HERO_DATA } from '@myrddraall/heroes-replay-stats-heroes/data';
import { heroLookup, type HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { ReplayService } from '../../data/replays/replay.service';
import { ReplayStatsService } from '../../data/replays/replay-stats.service';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { resolveYou } from '@myrddraall/heroes-replay-stats-players/model';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';

/**
 * {@link ReplayPage}'s component store: the replay shown, who "you" are in it, its game build's
 * hero data and pictures, and its stats tables, which the page's sections (its child routes) read.
 */
export const ReplayPageStore = signalStore(
  withState({ replayId: null as string | null }),
  withProps(({ replayId }) => {
    const stats = inject(ReplayStatsService);
    const id = () => replayId() ?? undefined;
    return {
      _replays: inject(ReplayService),
      _settings: inject(SettingsStore),
      _provider: inject(HERO_DATA),
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
  withComputed(({ replayId, _replays }) => ({
    /** Null until the list has loaded, and for a replay that is not stored (or not ready). */
    replay: computed(() => _replays.replays().find((r) => r.id === replayId()) ?? null),
  })),
  withProps(({ replay, _provider }) => ({
    /** The hero data of the replay's own game build (the nearest one published). */
    _heroData: resource({
      params: () => replay()?.build,
      loader: ({ params }) => _provider.forBuild(params),
    }),
  })),
  withComputed(({ replay, _replays, _settings, _heroData, _scoreScreen, _playerStats }) => {
    /** Null until it has loaded. */
    const heroData = computed(() => (_heroData.hasValue() ? (_heroData.value() ?? null) : null));
    /** The pictures for its file names (heroes-images' until it has loaded). */
    const images = computed(() => heroesImages({ data: heroData() ?? undefined }));
    /** Heroes' icons and maps' previews from it; knows nothing until it has loaded. */
    const heroes = computed(() => heroLookup(heroData() ?? undefined, images()));
    return {
      /** False until the replay list has loaded. */
      loaded: _replays.loaded,
      you: computed(() => {
        const r = replay();
        return r ? resolveYou(r, new Set(_settings.meToonHandles())) : { slots: [], team: null };
      }),
      heroData,
      images,
      heroes,
      /** Each player's hero icon, by slot; `null` for a hero the data doesn't know. */
      icons: computed((): Readonly<Record<number, HeroIcon | null>> => {
        const lookup = heroes();
        return Object.fromEntries(
          (replay()?.players ?? []).map((p) => [p.slot, lookup.heroIcon(p.heroId, p.hero)]),
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
