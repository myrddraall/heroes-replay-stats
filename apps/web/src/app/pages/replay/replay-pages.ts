import { STAT_SECTION_IDS, STAT_SECTIONS } from './stats/stat-sections';

/** One of a replay's pages, by its path under the replay (`stats/pvp`). */
export interface ReplayPageLink {
  readonly path: string;
  readonly title: string;
}

/** A category of a replay's pages, as its navigation lists them. */
export interface ReplayPageGroup {
  readonly title: string;
  readonly pages: readonly ReplayPageLink[];
}

/** A replay's pages by category, in the order its navigation lists them. */
export const REPLAY_PAGES: readonly ReplayPageGroup[] = [
  {
    title: 'Overview',
    pages: [
      { path: 'score', title: 'Score' },
      { path: 'teams', title: 'Teams' },
      { path: 'draft', title: 'Draft' },
      { path: 'talents', title: 'Talents' },
      { path: 'chat', title: 'Chat' },
    ],
  },
  {
    title: 'Stats',
    pages: [
      ...STAT_SECTION_IDS.map((id) => ({ path: `stats/${id}`, title: STAT_SECTIONS[id].title })),
      { path: 'unit-kills', title: 'Unit Kills' },
      { path: 'xp', title: 'XP' },
    ],
  },
];
