import type { HeroDataSet, HeroesImages, Picture } from '@myrddraall/hero-data';

/** A picture of a hero (an icon, a portrait), and the hero's name for it. */
export interface HeroIcon {
  readonly picture: Picture;
  readonly name: string;
}

/**
 * A match award as the game's score screen shows it: its badge in each team's colour (`null` where
 * the data names none), and its name and description.
 */
export interface AwardBadges {
  readonly name: string;
  readonly description: string | null;
  readonly blue: Picture | null;
  readonly red: Picture | null;
}

/**
 * What the app shows from the hero data: heroes' minimap icons and leaderboard portraits, match
 * awards' badges, and maps' replay previews.
 */
export interface HeroLookup {
  /**
   * By the hero id a replay records (`Barbarian`), or else the hero's name (`D.Va`, whose id is
   * the unit she spawns as, `DVaPilot`, which the data doesn't list); `null` for a hero the data
   * doesn't know.
   */
  heroIcon(heroId: string, name?: string): HeroIcon | null;
  /**
   * The hero's leaderboard portrait (100 × 56, as the game's score screen shows it), found as
   * {@link heroIcon} finds the hero; `null` for a hero the data doesn't know.
   */
  heroPortrait(heroId: string, name?: string): HeroIcon | null;
  /**
   * The hero data's own id for a replay's hero (`DVaPilot` → `DVa`), found as {@link heroIcon}
   * finds it; `null` for a hero the data doesn't know.
   */
  heroDataId(heroId: string, name?: string): string | null;
  /**
   * A match award's score-screen badges, by the id a replay records (`MostHealing`, `MVP`); `null`
   * for an award the data doesn't know.
   */
  award(awardId: string): AwardBadges | null;
  /** By the map's name as a replay records it; `null` for a map the data doesn't know. */
  mapPreview(map: string): Picture | null;
}

/** The lookup over a hero data set, or one that knows nothing while the data loads. */
export function heroLookup(
  data: HeroDataSet | undefined,
  images: HeroesImages,
): HeroLookup {
  const find = (heroId: string, name?: string) =>
    data?.hero(heroId) ?? (name === undefined ? undefined : data?.hero(name));
  return {
    heroDataId: (heroId, name) => find(heroId, name)?.id ?? null,
    heroIcon: (heroId, name) => {
      const hero = find(heroId, name);
      const picture = hero ? images.portrait(hero, 'minimap') : null;
      return hero && picture ? { picture, name: hero.name } : null;
    },
    heroPortrait: (heroId, name) => {
      const hero = find(heroId, name);
      const picture = hero ? images.portrait(hero, 'leaderboard') : null;
      return hero && picture ? { picture, name: hero.name } : null;
    },
    award: (awardId) => {
      const award = data?.award(awardId);
      return award
        ? {
            name: award.name ?? award.id,
            description: award.description,
            blue: images.award(award, 'scoreScreen', 'blue'),
            red: images.award(award, 'scoreScreen', 'red'),
          }
        : null;
    },
    mapPreview: (map) => {
      const info = data?.map(map);
      return info ? (images.map(info, 'replayPreview') ?? null) : null;
    },
  };
}
