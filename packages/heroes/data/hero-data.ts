import { computed, inject, InjectionToken, resource, Service } from '@angular/core';
import {
  heroesAssetsProvider,
  heroesImages,
  type HeroDataProvider,
  type TextCache,
} from '@myrddraall/hero-data';
import { heroLookup } from '../model';

/**
 * Hero, talent, award and map data, loaded at runtime: from heroes-assets for builds from 97039
 * on (each build's own, with its pictures in sheets), and from HeroesToolChest's archive before.
 */
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

/** heroes-assets' hero data, its raw files kept in Cache Storage. */
export function cachedHeroData(): HeroDataProvider {
  return heroesAssetsProvider({ cache: cacheStorage() });
}

/** Hero data for the newest build: what the app shows outside a single replay. */
@Service()
export class LatestHeroData {
  private readonly provider = inject(HERO_DATA);
  readonly data = resource({ loader: () => this.provider.latest() });
  /** The pictures for this data's file names (heroes-images' until it has loaded). */
  readonly images = computed(() =>
    heroesImages({ data: this.data.hasValue() ? this.data.value() : undefined }),
  );
  /** Heroes' icons and maps' previews from this data; knows nothing until it has loaded. */
  readonly lookup = computed(() =>
    heroLookup(this.data.hasValue() ? this.data.value() : undefined, this.images()),
  );
}
