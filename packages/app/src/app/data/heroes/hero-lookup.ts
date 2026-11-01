import type { heroesImages, HeroDataSet } from '@myrddraall/hero-data';

/** A hero's minimap icon, and the hero's name for it. */
export interface HeroIcon {
  readonly src: string;
  readonly name: string;
}

/** What the app shows from the hero data: heroes' minimap icons and maps' replay previews. */
export interface HeroLookup {
  /**
   * By the hero id a replay records (`Barbarian`), or else the hero's name (`D.Va`, whose id is
   * the unit she spawns as, `DVaPilot`, which the data doesn't list); `null` for a hero the data
   * doesn't know.
   */
  heroIcon(heroId: string, name?: string): HeroIcon | null;
  /**
   * The hero data's own id for a replay's hero (`DVaPilot` → `DVa`), found as {@link heroIcon}
   * finds it; `null` for a hero the data doesn't know.
   */
  heroDataId(heroId: string, name?: string): string | null;
  /** By the map's name as a replay records it; `null` for a map the data doesn't know. */
  mapPreview(map: string): string | null;
}

/** The lookup over a hero data set, or one that knows nothing while the data loads. */
export function heroLookup(
  data: HeroDataSet | undefined,
  images: ReturnType<typeof heroesImages>,
): HeroLookup {
  const find = (heroId: string, name?: string) =>
    data?.hero(heroId) ?? (name === undefined ? undefined : data?.hero(name));
  return {
    heroDataId: (heroId, name) => find(heroId, name)?.id ?? null,
    heroIcon: (heroId, name) => {
      const hero = find(heroId, name);
      const src = hero ? images.portrait(hero, 'minimap') : null;
      return hero && src ? { src, name: hero.name } : null;
    },
    mapPreview: (map) => {
      const info = data?.map(map);
      return info ? (images.map(info, 'replayPreview') ?? null) : null;
    },
  };
}
