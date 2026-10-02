import { inject, InjectionToken, type Provider, resource, Service } from '@angular/core';
import {
  heroesImages,
  heroesToolChestProvider,
  type HeroDataProvider,
  type TextCache,
} from '@myrddraall/hero-data';

/** Hero, talent and award data, loaded from HeroesToolChest at runtime. */
export const HERO_DATA = new InjectionToken<HeroDataProvider>('hrs.hero-data');

/** The raw hero-data files in Cache Storage, so each build downloads once. A failing cache is a miss. */
function cacheStorage(): TextCache | undefined {
  if (typeof caches === 'undefined') return undefined;
  // Cache Storage keys must be http(s) URLs; this host is never requested
  const key = (name: string) => `https://hero-data.invalid/${name}`;
  return {
    get: async (name) => {
      try {
        return await (await (await caches.open('hrs-hero-data')).match(key(name)))?.text();
      } catch {
        return undefined;
      }
    },
    set: async (name, value) => {
      try {
        await (await caches.open('hrs-hero-data')).put(key(name), new Response(value));
      } catch {
        // not cached; it is fetched again next session
      }
    },
  };
}

export function provideHeroData(): Provider[] {
  return [
    { provide: HERO_DATA, useFactory: () => heroesToolChestProvider({ cache: cacheStorage() }) },
  ];
}

/** Hero data for the newest build: what the app shows outside a single replay. */
@Service()
export class LatestHeroData {
  private readonly provider = inject(HERO_DATA);
  readonly data = resource({ loader: () => this.provider.latest() });
  readonly images = heroesImages();
}
