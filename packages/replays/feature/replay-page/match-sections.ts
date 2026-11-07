import type { ShellNavLink } from '@myrddraall/heroes-replay-stats-shell/model';
import { hasDraft, STAT_SECTION_IDS, STAT_SECTIONS, type ReplaySummary } from '../../model';
import { TEAM_STAT_GROUPS } from '../../ui';

/**
 * A match's sections, as the shell's navigation lists them, in three groups: Overview (the score
 * screen, the talents, the draft where the game had one, the chat), Player Stats (each player
 * stats section, then each player's unit kills) and Team Stats (each team table on its own).
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
        ...STAT_SECTION_IDS.map((s) => ({ label: STAT_SECTIONS[s].title, link: at(`players/${s}`) })),
        { label: 'Unit Kills', link: at('players/unit-kills') },
      ],
    },
    {
      label: 'Team Stats',
      link: at('teams'),
      children: [
        ...TEAM_STAT_GROUPS.map((g) => ({ label: g.title, link: at(`teams/${g.id}`) })),
        { label: 'Unit Kills', link: at('teams/unit-kills') },
        { label: 'XP Over Time', link: at('teams/xp-over-time') },
      ],
    },
  ];
}
