import type { HeroDataProvider, HeroDataSet, HeroInfo, MapInfo } from '@myrddraall/hero-data';

const sonya = {
  id: 'Barbarian',
  name: 'Sonya',
  portraits: { minimap: 'storm_ui_minimapicon_heros_femalebarbarian.png', partyFrames: [] },
} as unknown as HeroInfo;

const towers = {
  id: 'Towers of Doom',
  name: 'Towers of Doom',
  width: 184,
  height: 190,
  replayPreviewImage: 'replayspreviewimage_towersofdoom.png',
  loadingScreenImage: 'storm_ui_homescreenbackground_towersofdoom.jpg',
  objectives: [
    {
      title: 'Altars',
      description: 'Capture altars to fire on the enemy core.',
      icons: ['storm_ui_ingame_mapmechanic_towersofdoom_altar.png'],
    },
    { title: null, description: 'An untitled note the panel leaves out.', icons: [] },
  ],
} as unknown as MapInfo;

/** For tests: a provider whose latest build knows only Sonya and Towers of Doom. */
export const fakeHeroData: HeroDataProvider = {
  latest: async () =>
    ({
      hero: (id: string) => (id === 'Barbarian' ? sonya : undefined),
      map: (name: string) => (name === 'Towers of Doom' ? towers : undefined),
    }) as unknown as HeroDataSet,
  forBuild: async () => {
    throw new Error('not used');
  },
  builds: async () => [],
};
