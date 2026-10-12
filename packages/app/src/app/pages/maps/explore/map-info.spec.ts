import type { MapPack, MapViewModel } from '@myrddraall/heroes-replay-stats-map';
import { describe, expect, it } from 'vitest';
import { fakeHeroData } from '../../../data/heroes/hero-data.fake';
import { iconName, mapArtOf, mapExtraInfoOf } from './map-info';

/** A map whose pack has a loading screen (and it smaller) and two of its icons, served from packs/. */
const towers = {
  pack: {
    images: {
      loadingScreen: {
        file: 'images/loading-screen.webp',
        size: [1920, 1080],
        source: 'ui_ingame_mapmechanic_loadscreen_towersofdoom.dds',
        smaller: [
          { file: 'images/loading-screen-960w.webp', size: [960, 540] },
          { file: 'images/loading-screen-480w.webp', size: [480, 270] },
        ],
      },
      loadingScreenIcons: [1, 2].map((n) => ({
        file: `images/loading-screen-icon-${n}.webp`,
        size: [200, 200],
        source: `ui_ingame_mapmechanic_loadscreen_TowersOfDoom_icon${n}.dds`,
      })),
    },
  } as unknown as MapPack,
  assets: { url: (file: string) => `packs/${file}` },
} as unknown as MapViewModel;

describe("a map's art and what hero-data adds to it", () => {
  it("gives the pack's loading screen and its icons by name", () => {
    const art = mapArtOf(towers);
    // Every size the pack has, by width, for the browser to pick from.
    expect(art.loadingScreen).toEqual({
      src: 'packs/images/loading-screen.webp',
      srcset:
        'packs/images/loading-screen.webp 1920w, packs/images/loading-screen-960w.webp 960w, packs/images/loading-screen-480w.webp 480w',
      width: 1920,
      height: 1080,
    });
    expect([...art.icons.keys()]).toEqual([
      'ui_ingame_mapmechanic_loadscreen_towersofdoom_icon1',
      'ui_ingame_mapmechanic_loadscreen_towersofdoom_icon2',
    ]);
    // A picture with no smaller versions: its own size only.
    expect(art.icons.get('ui_ingame_mapmechanic_loadscreen_towersofdoom_icon1')!.srcset).toBe(
      'packs/images/loading-screen-icon-1.webp 200w',
    );
    expect(mapArtOf(null)).toEqual({ loadingScreen: null, icons: new Map() });
    expect(iconName('Assets\\Textures\\Some_Icon.DDS')).toBe('some_icon');
  });

  it("gives the objectives with the pack's icons hero-data names, for a map it knows", async () => {
    const extra = mapExtraInfoOf('Towers of Doom', await fakeHeroData.latest(), mapArtOf(towers));
    expect(extra.known).toBe(true);
    expect(extra.objectives.map((o) => o.title)).toEqual(['Altars']); // the untitled one is left out
    expect(extra.objectives[0].description).toBe('Capture altars to fire on the enemy core.');
    // The icon the pack has, by name (hero-data's PNG, the pack's game file); the one it hasn't left out.
    expect(extra.objectives[0].icons.map((i) => i.src)).toEqual(['packs/images/loading-screen-icon-2.webp']);
  });

  it('gives nothing for a map it does not know, or while the data has not loaded', async () => {
    const art = mapArtOf(towers);
    const unknown = mapExtraInfoOf('Battlefield of Eternity', await fakeHeroData.latest(), art);
    expect(unknown).toEqual({ known: false, objectives: [] });
    expect(mapExtraInfoOf('Towers of Doom', undefined, art).known).toBe(false);
  });
});
