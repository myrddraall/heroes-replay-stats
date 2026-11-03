import type { Routes } from '@angular/router';
import { STAT_SECTION_IDS } from '../model';

/**
 * A replay's pages, under its page: the score screen, the team stats, the draft, the talents, the chat, each
 * player stats section, the unit kills and the XP.
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
    path: 'unit-kills',
    loadComponent: () => import('../feature/unit-kills-section').then((m) => m.UnitKillsSection),
  },
  {
    path: 'xp',
    loadComponent: () => import('../feature/xp-section').then((m) => m.XpSection),
  },
  { path: '**', redirectTo: 'score' },
];
