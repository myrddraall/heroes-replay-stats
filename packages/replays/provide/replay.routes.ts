import type { Routes } from '@angular/router';
import { STAT_SECTION_IDS } from '../model';
import { TEAM_STAT_GROUPS } from '../ui';

const score = () => import('../feature/score-section').then((m) => m.ScoreSection);
const stats = () => import('../feature/stats-section').then((m) => m.StatsSection);
const teams = () => import('../feature/teams-section').then((m) => m.TeamsSection);
const unitKills = () => import('../feature/unit-kills-section').then((m) => m.UnitKillsSection);

/**
 * A replay's pages, under its page, in three groups (match-sections.ts lists them):
 * - overview/: the score screen, the talents, the draft and the chat;
 * - players/: each player stats section, and each player's unit kills;
 * - teams/: each team stats table on its own (combat, XP, structures, camps), each team's unit
 *   kills, and the XP over time.
 * Their old addresses lead there.
 */
export const replayRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview/score' },
  { path: 'overview', pathMatch: 'full', redirectTo: 'overview/score' },
  { path: 'overview/score', loadComponent: score },
  {
    path: 'overview/talents',
    loadComponent: () => import('../feature/talents-section').then((m) => m.TalentsSection),
  },
  {
    path: 'overview/draft',
    loadComponent: () => import('../feature/draft-section').then((m) => m.DraftSection),
  },
  {
    path: 'overview/chat',
    loadComponent: () => import('../feature/chat-section').then((m) => m.ChatSection),
  },
  { path: 'players', pathMatch: 'full', redirectTo: `players/${STAT_SECTION_IDS[0]}` },
  ...STAT_SECTION_IDS.map((section) => ({
    path: `players/${section}`,
    data: { section },
    loadComponent: stats,
  })),
  { path: 'players/unit-kills', data: { table: 'players' }, loadComponent: unitKills },
  { path: 'teams', pathMatch: 'full', redirectTo: `teams/${TEAM_STAT_GROUPS[0]!.id}` },
  ...TEAM_STAT_GROUPS.map((group) => ({
    path: `teams/${group.id}`,
    data: { group: group.id },
    loadComponent: teams,
  })),
  { path: 'teams/unit-kills', data: { table: 'teams' }, loadComponent: unitKills },
  {
    path: 'teams/xp-over-time',
    loadComponent: () => import('../feature/xp-section').then((m) => m.XpSection),
  },
  // the old addresses
  { path: 'score', redirectTo: 'overview/score' },
  { path: 'talents', redirectTo: 'overview/talents' },
  { path: 'draft', redirectTo: 'overview/draft' },
  { path: 'chat', redirectTo: 'overview/chat' },
  { path: 'stats', pathMatch: 'full', redirectTo: 'players' },
  { path: 'stats/unit-kills', redirectTo: 'players/unit-kills' },
  { path: 'stats/xp', redirectTo: 'teams/xp-over-time' },
  ...STAT_SECTION_IDS.map((section) => ({
    path: `stats/${section}`,
    redirectTo: `players/${section}`,
  })),
  { path: 'unit-kills', redirectTo: 'players/unit-kills' },
  { path: 'xp', redirectTo: 'teams/xp-over-time' },
  { path: '**', redirectTo: 'overview/score' },
];
