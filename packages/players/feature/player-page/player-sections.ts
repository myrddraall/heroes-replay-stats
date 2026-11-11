import type { ShellNavLink } from '@myrddraall/heroes-replay-stats-shell/model';
import { PLAYER_STAT_SECTION_IDS, PLAYER_STAT_SECTIONS } from '../../model';

/** A player's page's address: their id as one segment of it. */
export function playerLink(playerId: string): string {
  return `/replays/players/${encodeURIComponent(playerId)}`;
}

/**
 * A player's sections, as the shell's navigation lists them: the overview, the stats tables (a
 * summary, then a match's player stats sections), the records, the people they played with and
 * against, and their matches.
 */
export function playerSections(playerId: string): ShellNavLink[] {
  const at = (path: string) => `${playerLink(playerId)}/${path}`;
  return [
    { label: 'Overview', link: at('overview') },
    {
      label: 'Stats',
      link: at('stats'),
      children: PLAYER_STAT_SECTION_IDS.map((s) => ({
        label: PLAYER_STAT_SECTIONS[s].title,
        link: at(`stats/${s}`),
      })),
    },
    { label: 'Records', link: at('records') },
    {
      label: 'Players',
      link: at('players'),
      children: [
        { label: 'Teammates', link: at('players/teammates') },
        { label: 'Opponents', link: at('players/opponents') },
      ],
    },
    { label: 'Matches', link: at('matches') },
  ];
}
