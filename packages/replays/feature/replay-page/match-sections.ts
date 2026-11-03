import type { ShellNavLink } from '@myrddraall/heroes-replay-stats-shell/model';
import { STAT_SECTION_IDS, STAT_SECTIONS } from '../../model';

/** A match's sections, as the shell's navigation lists them: level 2, and Stats' level 3. */
export function matchSections(id: string): ShellNavLink[] {
  const at = (path: string) => `/matches/${id}/${path}`;
  return [
    { label: 'Score', link: at('score') },
    { label: 'Teams', link: at('teams') },
    { label: 'Draft', link: at('draft') },
    { label: 'Talents', link: at('talents') },
    { label: 'Chat', link: at('chat') },
    {
      label: 'Stats',
      link: at('stats'),
      children: STAT_SECTION_IDS.map((s) => ({ label: STAT_SECTIONS[s].title, link: at(`stats/${s}`) })),
    },
    { label: 'Unit Kills', link: at('unit-kills') },
    { label: 'XP', link: at('xp') },
  ];
}
