import type { Routes } from '@angular/router';
import { STAT_SECTION_IDS } from '../model';
import { TEAM_STAT_GROUPS } from '../ui';

const score = () => import('../feature/score-section').then((m) => m.ScoreSection);
const stats = () => import('../feature/stats-section').then((m) => m.StatsSection);
const teams = () => import('../feature/teams-section').then((m) => m.TeamsSection);
const unitKills = () => import('../feature/unit-kills-section').then((m) => m.UnitKillsSection);
const xp = () => import('../feature/xp-section').then((m) => m.XpSection);
const timeline = () => import('../feature/timeline-section').then((m) => m.TimelineSection);
const playerChart = () =>
  import('../feature/player-chart-section').then((m) => m.PlayerChartSection);

/**
 * A replay's pages, under its page, in six groups (match-sections.ts lists them):
 * - overview/: the score screen, the talents, the draft and the chat;
 * - players/: each player stats section, each player's unit kills, the comparison and the APM;
 * - teams/: each team stats table on its own (combat, structures, camps), and each team's unit
 *   kills;
 * - xp/: the team XP totals (the team stats' XP table), and the XP charts: over time, per minute, the advantage, by source and the talent tiers;
 * - deaths/: the deaths charts: each player's time dead, who killed whom, and the fights;
 * - map/: the camps' captures and the structures destroyed.
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
  { path: 'players/compare', data: { chart: 'compare' }, loadComponent: playerChart },
  { path: 'players/apm', data: { chart: 'apm' }, loadComponent: playerChart },
  { path: 'teams', pathMatch: 'full', redirectTo: `teams/${TEAM_STAT_GROUPS[0]!.id}` },
  ...TEAM_STAT_GROUPS.filter((group) => group.id !== 'xp').map((group) => ({
    path: `teams/${group.id}`,
    data: { group: group.id },
    loadComponent: teams,
  })),
  { path: 'teams/unit-kills', data: { table: 'teams' }, loadComponent: unitKills },
  { path: 'xp', pathMatch: 'full', redirectTo: 'xp/totals' },
  // the team stats' XP table, as the XP section's totals
  { path: 'xp/totals', data: { group: 'xp' }, loadComponent: teams },
  { path: 'xp/over-time', data: { chart: 'over-time' }, loadComponent: xp },
  { path: 'xp/per-minute', data: { chart: 'per-minute' }, loadComponent: xp },
  { path: 'xp/advantage', data: { chart: 'advantage' }, loadComponent: xp },
  { path: 'xp/sources', data: { chart: 'sources' }, loadComponent: xp },
  { path: 'xp/talent-tiers', data: { chart: 'talent-tiers' }, loadComponent: timeline },
  { path: 'deaths', pathMatch: 'full', redirectTo: 'deaths/timeline' },
  { path: 'deaths/timeline', data: { chart: 'deaths' }, loadComponent: timeline },
  { path: 'deaths/takedowns', data: { chart: 'takedowns' }, loadComponent: timeline },
  { path: 'deaths/fights', data: { chart: 'fights' }, loadComponent: timeline },
  { path: 'map', pathMatch: 'full', redirectTo: 'map/camps' },
  { path: 'map/camps', data: { chart: 'camps' }, loadComponent: timeline },
  { path: 'map/structures', data: { chart: 'structures' }, loadComponent: timeline },
  // the old addresses
  { path: 'score', redirectTo: 'overview/score' },
  { path: 'talents', redirectTo: 'overview/talents' },
  { path: 'draft', redirectTo: 'overview/draft' },
  { path: 'chat', redirectTo: 'overview/chat' },
  { path: 'stats', pathMatch: 'full', redirectTo: 'players' },
  { path: 'stats/unit-kills', redirectTo: 'players/unit-kills' },
  { path: 'stats/xp', redirectTo: 'xp/over-time' },
  { path: 'teams/xp-over-time', redirectTo: 'xp/over-time' },
  { path: 'teams/xp', redirectTo: 'xp/totals' },
  ...STAT_SECTION_IDS.map((section) => ({
    path: `stats/${section}`,
    redirectTo: `players/${section}`,
  })),
  { path: 'unit-kills', redirectTo: 'players/unit-kills' },
  { path: '**', redirectTo: 'overview/score' },
];
