import type { Routes } from '@angular/router';
import { STAT_SECTION_IDS } from './stats/stat-sections';

/**
 * A replay's pages, under its page: the score screen, the team stats, the draft, the talents, the chat, each
 * player stats section, the unit kills and the XP.
 */
export const replayRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'score' },
  {
    path: 'score',
    loadComponent: () => import('./score/score-section').then((m) => m.ScoreSection),
  },
  {
    path: 'teams',
    loadComponent: () => import('./teams/teams-section').then((m) => m.TeamsSection),
  },
  {
    path: 'draft',
    loadComponent: () => import('./draft/draft-section').then((m) => m.DraftSection),
  },
  {
    path: 'talents',
    loadComponent: () => import('./talents/talents-section').then((m) => m.TalentsSection),
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
  {
    path: 'unit-kills',
    loadComponent: () => import('./unit-kills/unit-kills-section').then((m) => m.UnitKillsSection),
  },
  {
    path: 'xp',
    loadComponent: () => import('./xp/xp-section').then((m) => m.XpSection),
  },
  { path: '**', redirectTo: 'score' },
];
