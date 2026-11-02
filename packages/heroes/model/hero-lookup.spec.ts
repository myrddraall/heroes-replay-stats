import { heroesImages } from '@myrddraall/hero-data';
import { describe, expect, it } from 'vitest';
import { fakeHeroData } from '../testing';
import { heroLookup } from './hero-lookup';

describe('heroLookup', () => {
  it("finds a hero's minimap icon from heroes-images, named for the hero", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    expect(lookup.heroIcon('Barbarian')).toEqual({
      picture: {
        src: 'https://raw.githubusercontent.com/HeroesToolChest/heroes-images/main/heroesimages/heroportraits/storm_ui_minimapicon_heros_femalebarbarian.png',
      },
      name: 'Sonya',
    });
    expect(lookup.heroIcon('NotAHero')).toBeNull();
  });

  it("falls back to the hero's name for an id the data doesn't list", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    expect(lookup.heroIcon('BarbarianSpawn', 'Sonya')?.name).toBe('Sonya');
    expect(lookup.heroIcon('BarbarianSpawn', 'Nobody')).toBeNull();
    expect(lookup.heroDataId('BarbarianSpawn', 'Sonya')).toBe('Barbarian');
    expect(lookup.heroDataId('NotAHero')).toBeNull();
  });

  it("finds a map's replay preview", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    expect(lookup.mapPreview('Towers of Doom')).toEqual({
      src: 'https://raw.githubusercontent.com/HeroesToolChest/heroes-images/main/heroesimages/replaypreviews/replayspreviewimage_towersofdoom.png',
    });
    expect(lookup.mapPreview('Nowhere')).toBeNull();
  });

  it('knows nothing while the data loads', () => {
    const lookup = heroLookup(undefined, heroesImages());
    expect(lookup.heroIcon('Barbarian')).toBeNull();
    expect(lookup.mapPreview('Towers of Doom')).toBeNull();
  });
});
