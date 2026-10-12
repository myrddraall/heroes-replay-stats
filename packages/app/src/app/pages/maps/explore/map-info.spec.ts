import { heroesImages } from '@myrddraall/hero-data';
import { describe, expect, it } from 'vitest';
import { fakeHeroData } from '../../../data/heroes/hero-data.fake';
import { mapExtraInfoOf } from './map-info';

describe('what hero-data adds to a map', () => {
  const images = heroesImages();

  it('gives the objectives with their icons, and the art, for a map it knows', async () => {
    const extra = mapExtraInfoOf('Towers of Doom', await fakeHeroData.latest(), images);
    expect(extra.known).toBe(true);
    expect(extra.objectives.map((o) => o.title)).toEqual(['Altars']); // the untitled one is left out
    expect(extra.objectives[0].description).toBe('Capture altars to fire on the enemy core.');
    expect(extra.objectives[0].iconUrls[0]).toMatch(
      /mapobjectives\/storm_ui_ingame_mapmechanic_towersofdoom_altar\.png$/,
    );
    expect(extra.images.loadingScreen).toMatch(/storm_ui_homescreenbackground_towersofdoom\.jpg$/);
    expect(extra.images.replayPreview).toMatch(/replayspreviewimage_towersofdoom\.png$/);
  });

  it('gives nothing for a map it does not know, or while the data has not loaded', async () => {
    const unknown = mapExtraInfoOf('Battlefield of Eternity', await fakeHeroData.latest(), images);
    expect(unknown).toEqual({
      known: false,
      objectives: [],
      images: { replayPreview: null, loadingScreen: null },
    });
    expect(mapExtraInfoOf('Towers of Doom', undefined, images).known).toBe(false);
  });
});
