import type { Routes } from '@angular/router';
import { STAT_SECTION_IDS } from './stats/stat-sections';

/** A replay's pages, under its page: the score screen, the chat and each player stats section. */
export const replayRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'score' },
  {
    path: 'score',
    loadComponent: () => import('./score/score-section').then((m) => m.ScoreSection),
  },
  {
    path: 'chat',
    loadComponent: () => import('./chat/chat-section').then((m) => m.ChatSection),
  },
  { path: 'stats', pathMatch: 'full', redirectTo: `stats/${STAT_SECTION_IDS[0]}` },
  ...STAT_SECTION_IDS.map((section) => ({
    path: `stats/${section}`,
    data: { section },
    loadComponent: () => import('./stats/stats-section').then((m) => m.StatsSection),
  })),
  { path: '**', redirectTo: 'score' },
];
