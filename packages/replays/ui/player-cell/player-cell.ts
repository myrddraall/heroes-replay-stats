import { Component, inject, input } from '@angular/core';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { TeamTheme } from '../team-theme/team-theme';

/**
 * A player: their hero's icon, the hero and their name. Themed as their team (`team`), or as the
 * user's own (`self`: `blue-self`, `red-self`, the names in the theme's colour and "(you)" said to
 * screen readers); with neither, it takes the theme around it (a stats row's). Sized in em: the
 * hero's name at its font-size, the icon 2.5em, the player's name 0.9em.
 */
@Component({
  selector: 'hrs-player-cell',
  imports: [HeroMinimapIcon],
  hostDirectives: [{ directive: TeamTheme, inputs: ['hrsTeam: team', 'hrsTeamSelf: self'] }],
  host: { '[class.self]': 'self()' },
  templateUrl: './player-cell.html',
  styleUrl: './player-cell.scss',
})
export class PlayerCell {
  readonly hero = input.required<string>();
  readonly name = input.required<string>();
  readonly icon = input<HeroIcon | null>(null);
  protected readonly self = inject(TeamTheme).hrsTeamSelf;
}
