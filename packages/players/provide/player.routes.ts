import type { Routes } from '@angular/router';
import { PLAYER_STAT_SECTION_IDS } from '../model';

const stats = () => import('../feature/stats-section').then((m) => m.StatsSection);
const peers = () => import('../feature/peers-section').then((m) => m.PeersSection);

/**
 * A player's pages, under their page (player-sections.ts lists them):
 * - overview: their matches at a glance;
 * - stats/: each stats section's table, a row for each hero, role, map or mode;
 * - records: their highest figures and the matches they were in;
 * - players/: the people they played with and against;
 * - matches: their matches.
 */
export const playerRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    loadComponent: () => import('../feature/overview-section').then((m) => m.OverviewSection),
  },
  { path: 'stats', pathMatch: 'full', redirectTo: `stats/${PLAYER_STAT_SECTION_IDS[0]}` },
  ...PLAYER_STAT_SECTION_IDS.map((section) => ({
    path: `stats/${section}`,
    data: { section },
    loadComponent: stats,
  })),
  {
    path: 'records',
    loadComponent: () => import('../feature/records-section').then((m) => m.RecordsSection),
  },
  { path: 'players', pathMatch: 'full', redirectTo: 'players/teammates' },
  { path: 'players/teammates', data: { side: 'with' }, loadComponent: peers },
  { path: 'players/opponents', data: { side: 'against' }, loadComponent: peers },
  {
    path: 'matches',
    loadComponent: () => import('../feature/matches-section').then((m) => m.MatchesSection),
  },
  { path: '**', redirectTo: 'overview' },
];
