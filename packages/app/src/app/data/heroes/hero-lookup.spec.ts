import { heroesImages } from '@myrddraall/hero-data';
import { describe, expect, it } from 'vitest';
import { fakeHeroData } from './hero-data.fake';
import { heroLookup } from './hero-lookup';

describe('heroLookup', () => {
  it("finds a hero's minimap icon from heroes-images, named for the hero", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    expect(lookup.heroIcon('Barbarian')).toEqual({
      src: 'https://cdn.jsdelivr.net/gh/HeroesToolChest/heroes-images@main/heroesimages/heroportraits/storm_ui_minimapicon_heros_femalebarbarian.png',
      name: 'Sonya',
    });
    expect(lookup.heroIcon('NotAHero')).toBeNull();
  });

  it("finds a map's replay preview", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    expect(lookup.mapPreview('Towers of Doom')).toBe(
      'https://cdn.jsdelivr.net/gh/HeroesToolChest/heroes-images@main/heroesimages/replaypreviews/replayspreviewimage_towersofdoom.png',
    );
    expect(lookup.mapPreview('Nowhere')).toBeNull();
  });

  it('knows nothing while the data loads', () => {
    const lookup = heroLookup(undefined, heroesImages());
    expect(lookup.heroIcon('Barbarian')).toBeNull();
    expect(lookup.mapPreview('Towers of Doom')).toBeNull();
  });
});
