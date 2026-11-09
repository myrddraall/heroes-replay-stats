import type { ShellNavLink } from '@myrddraall/heroes-replay-stats-shell/model';
import { hasDraft, STAT_SECTION_IDS, STAT_SECTIONS, type ReplaySummary } from '../../model';
import { TEAM_STAT_GROUPS } from '../../ui';

/**
 * A match's sections, as the shell's navigation lists them, in six groups: Overview (the score
 * screen, the talents, the draft where the game had one, the chat), Player Stats (each player
 * stats section, each player's unit kills, the comparison, the APM), Team Stats (each team table on
 * its own, but XP's), XP (the totals, over time, per minute, the advantage, by source, the talent tiers), Deaths (the
 * timeline, the takedowns, the fights) and Map (the camps, the structures).
 */
export function matchSections(replay: Pick<ReplaySummary, 'id' | 'mode'>): ShellNavLink[] {
  const at = (path: string) => `/replays/matches/${replay.id}/${path}`;
  return [
    {
      label: 'Overview',
      link: at('overview'),
      children: [
        { label: 'Score', link: at('overview/score') },
        { label: 'Talents', link: at('overview/talents') },
        ...(hasDraft(replay.mode) ? [{ label: 'Draft', link: at('overview/draft') }] : []),
        { label: 'Chat', link: at('overview/chat') },
      ],
    },
    {
      label: 'Player Stats',
      link: at('players'),
      children: [
        ...STAT_SECTION_IDS.map((s) => ({
          label: STAT_SECTIONS[s].title,
          link: at(`players/${s}`),
        })),
        { label: 'Unit Kills', link: at('players/unit-kills') },
        { label: 'Compare', link: at('players/compare') },
        { label: 'APM', link: at('players/apm') },
      ],
    },
    {
      label: 'Team Stats',
      link: at('teams'),
      children: [
        // the XP table is in the XP section, as its totals
        ...TEAM_STAT_GROUPS.filter((g) => g.id !== 'xp').map((g) => ({
          label: g.title,
          link: at(`teams/${g.id}`),
        })),
        { label: 'Unit Kills', link: at('teams/unit-kills') },
      ],
    },
    {
      label: 'XP',
      link: at('xp'),
      children: [
        { label: 'Totals', link: at('xp/totals') },
        { label: 'Over Time', link: at('xp/over-time') },
        { label: 'Per Minute', link: at('xp/per-minute') },
        { label: 'Advantage', link: at('xp/advantage') },
        { label: 'Sources', link: at('xp/sources') },
        { label: 'Talent Tiers', link: at('xp/talent-tiers') },
      ],
    },
    {
      label: 'Deaths',
      link: at('deaths'),
      children: [
        { label: 'Timeline', link: at('deaths/timeline') },
        { label: 'Takedowns', link: at('deaths/takedowns') },
        { label: 'Team Fights', link: at('deaths/fights') },
      ],
    },
    {
      label: 'Map',
      link: at('map'),
      children: [
        { label: 'Camps', link: at('map/camps') },
        { label: 'Structures', link: at('map/structures') },
      ],
    },
  ];
}
