import type { Routes } from '@angular/router';
import { STAT_SECTION_IDS } from '../model';

/**
 * A replay's pages, under its page: the score screen, the team stats, the draft, the talents, the chat, and
 * under the stats each player stats section, the unit kills and the XP (their old addresses lead there).
 */
export const replayRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'score' },
  {
    path: 'score',
    loadComponent: () => import('../feature/score-section').then((m) => m.ScoreSection),
  },
  {
    path: 'teams',
    loadComponent: () => import('../feature/teams-section').then((m) => m.TeamsSection),
  },
  {
    path: 'draft',
    loadComponent: () => import('../feature/draft-section').then((m) => m.DraftSection),
  },
  {
    path: 'talents',
    loadComponent: () => import('../feature/talents-section').then((m) => m.TalentsSection),
  },
  {
    path: 'chat',
    loadComponent: () => import('../feature/chat-section').then((m) => m.ChatSection),
  },
  { path: 'stats', pathMatch: 'full', redirectTo: `stats/${STAT_SECTION_IDS[0]}` },
  ...STAT_SECTION_IDS.map((section) => ({
    path: `stats/${section}`,
    data: { section },
    loadComponent: () => import('../feature/stats-section').then((m) => m.StatsSection),
  })),
  {
    path: 'stats/unit-kills',
    loadComponent: () => import('../feature/unit-kills-section').then((m) => m.UnitKillsSection),
  },
  {
    path: 'stats/xp',
    loadComponent: () => import('../feature/xp-section').then((m) => m.XpSection),
  },
  { path: 'unit-kills', redirectTo: 'stats/unit-kills' },
  { path: 'xp', redirectTo: 'stats/xp' },
  { path: '**', redirectTo: 'score' },
];
