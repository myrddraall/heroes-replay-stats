import { computed, effect, inject, resource, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { heroesImages } from '@myrddraall/hero-data';
import { HERO_DATA, LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import {
  heroLookup,
  type AwardBadges,
  type HeroIcon,
} from '@myrddraall/heroes-replay-stats-heroes/model';
import { ReplayService, ReplayStatsService, ViewedReplaysStore } from '../../data';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { resolveYou } from '../../model';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';

/**
 * {@link ReplayPage}'s component store: the replay shown, who "you" are in it, its game build's
 * hero data and pictures, and its stats tables, which the page's sections (its child routes) read.
 * The replay shown counts as viewed, as it is imported now.
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
      _latest: inject(LatestHeroData),
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
  withComputed(({ replay, _replays, _settings, _heroData, _latest, _scoreScreen, _playerStats }) => {
    /** The newest build's data: the pictures a build before heroes-assets has none of. */
    const latest = computed(() => (_latest.data.hasValue() ? _latest.data.value() : undefined));
    /**
     * Null until it has loaded, and for a build without pictures of its own until the newest
     * build's have: its pictures are those.
     */
    const heroData = computed(() => {
      const own = _heroData.hasValue() ? (_heroData.value() ?? null) : null;
      return own && (own.pictures || latest()) ? own : null;
    });
    /** The pictures for its file names: its own, else the newest build's. */
    const images = computed(() => heroesImages({ data: heroData() ?? undefined, fallback: latest() }));
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
      /** Each player's hero leaderboard portrait (the score screen's), by slot. */
      portraits: computed((): Readonly<Record<number, HeroIcon | null>> => {
        const lookup = heroes();
        return Object.fromEntries(
          (replay()?.players ?? []).map((p) => [p.slot, lookup.heroPortrait(p.heroId, p.hero)]),
        );
      }),
      scoreScreen: computed(() => (_scoreScreen.hasValue() ? _scoreScreen.value() : null)),
      /** The badges of the awards the score screen gives, by award id; `null` for one the data doesn't know. */
      awards: computed((): Readonly<Record<string, AwardBadges | null>> => {
        const lookup = heroes();
        const players = _scoreScreen.hasValue() ? (_scoreScreen.value()?.players ?? []) : [];
        const ids = new Set(players.flatMap((p) => p.awards));
        return Object.fromEntries([...ids].map((id) => [id, lookup.award(id)]));
      }),
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
  withHooks({
    onInit(store) {
      const viewed = inject(ViewedReplaysStore);
      // the match open, and each import of it while open, counts as viewed
      effect(() => {
        const r = store.replay();
        if (r) untracked(() => viewed.markViewed(r.id, r.importedAt));
      });
    },
  }),
);
