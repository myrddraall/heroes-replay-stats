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

  it("finds a hero's leaderboard portrait the same way", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    expect(lookup.heroPortrait('BarbarianSpawn', 'Sonya')).toEqual({
      picture: {
        src: 'https://raw.githubusercontent.com/HeroesToolChest/heroes-images/main/heroesimages/heroportraits/storm_ui_ingame_hero_leaderboard_barbarian.png',
      },
      name: 'Sonya',
    });
    expect(lookup.heroPortrait('NotAHero')).toBeNull();
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

  it("finds a match award's score-screen badges in both team colours, by a replay's award id", async () => {
    const lookup = heroLookup(await fakeHeroData.latest(), heroesImages());
    const base = 'https://raw.githubusercontent.com/HeroesToolChest/heroes-images/main/heroesimages/matchawards';
    expect(lookup.award('MostHealing')).toEqual({
      name: 'Main Healer',
      description: 'Highest Healing',
      blue: { src: `${base}/storm_ui_scorescreen_mvp_mainhealer_blue.png` },
      red: { src: `${base}/storm_ui_scorescreen_mvp_mainhealer_red.png` },
    });
    expect(lookup.award('NotAnAward')).toBeNull();
  });

  it('knows nothing while the data loads', () => {
    const lookup = heroLookup(undefined, heroesImages());
    expect(lookup.heroIcon('Barbarian')).toBeNull();
    expect(lookup.award('MostHealing')).toBeNull();
    expect(lookup.mapPreview('Towers of Doom')).toBeNull();
  });
});
