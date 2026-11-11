import type { AwardInfo, HeroDataProvider, HeroDataSet, HeroInfo, MapInfo } from '@myrddraall/hero-data';

const sonya = {
  id: 'Barbarian',
  name: 'Sonya',
  portraits: {
    minimap: 'storm_ui_minimapicon_heros_femalebarbarian.png',
    leaderboard: 'storm_ui_ingame_hero_leaderboard_barbarian.png',
    partyFrames: [],
  },
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
      icons: [
        'ui_ingame_mapmechanic_loadscreen_towersofdoom_icon2.png',
        'ui_ingame_mapmechanic_loadscreen_towersofdoom_icon9.png',
      ],
    },
    { title: null, description: 'An untitled note the panel leaves out.', icons: [] },
  ],
} as unknown as MapInfo;

const mainHealer: AwardInfo = {
  id: 'MostHealing',
  gameLink: 'EndOfMatchAwardMostHealingBoolean',
  tag: 'AwHL',
  name: 'Main Healer',
  description: 'Highest Healing',
  mvpScreenIcon: 'storm_ui_mvp_mainhealer_%color%.png',
  scoreScreenIcon: 'storm_ui_scorescreen_mvp_mainhealer_%team%.png',
};

/** For tests: a provider whose latest build knows only Sonya, Towers of Doom and Main Healer. */
export const fakeHeroData: HeroDataProvider = {
  latest: async () =>
    ({
      hero: (idOrName: string) =>
        idOrName === 'Barbarian' || idOrName === 'Sonya' ? sonya : undefined,
      map: (name: string) => (name === 'Towers of Doom' ? towers : undefined),
      award: (idOrLink: string) => (idOrLink === 'MostHealing' ? mainHealer : undefined),
    }) as unknown as HeroDataSet,
  forBuild: async () => {
    throw new Error('not used');
  },
  builds: async () => [],
};
