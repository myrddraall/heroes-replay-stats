import type { heroesImages, HeroDataSet } from '@myrddraall/hero-data';

/** A hero's minimap icon, and the hero's name for it. */
export interface HeroIcon {
  readonly src: string;
  readonly name: string;
}

/** What the app shows from the hero data: heroes' minimap icons and maps' replay previews. */
export interface HeroLookup {
  /** By the hero id a replay records (`Barbarian`); `null` for a hero the data doesn't know. */
  heroIcon(heroId: string): HeroIcon | null;
  /** By the map's name as a replay records it; `null` for a map the data doesn't know. */
  mapPreview(map: string): string | null;
}

/** The lookup over a hero data set, or one that knows nothing while the data loads. */
export function heroLookup(
  data: HeroDataSet | undefined,
  images: ReturnType<typeof heroesImages>,
): HeroLookup {
  return {
    heroIcon: (heroId) => {
      const hero = data?.hero(heroId);
      const src = hero ? images.portrait(hero, 'minimap') : null;
      return hero && src ? { src, name: hero.name } : null;
    },
    mapPreview: (map) => {
      const info = data?.map(map);
      return info ? (images.map(info, 'replayPreview') ?? null) : null;
    },
  };
}
