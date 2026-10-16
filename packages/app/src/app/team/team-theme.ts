import { computed, Directive, inject, input } from '@angular/core';
import type { Team } from '@myrddraall/heroprotocol-db';
import { teamColor, TeamPerspective } from './team-color';

/**
 * Themes an element as a team: `<tr [hrsTeam]="player.team">`. Adds the glass theme's team
 * variant, `hrs-glass-blue` or `hrs-glass-red` (see `theme/_glass.scss`), chosen by the
 * `TeamPerspective` above it. A null team leaves the element in the theme around it.
 */
@Directive({
  selector: '[hrsTeam]',
  host: {
    '[class.hrs-glass-blue]': "color() === 'blue'",
    '[class.hrs-glass-red]': "color() === 'red'",
  },
})
export class TeamTheme {
  readonly hrsTeam = input.required<Team | null>();
  private readonly perspective = inject(TeamPerspective, { optional: true });

  protected readonly color = computed(() => {
    const team = this.hrsTeam();
    if (team === null) return null;
    return teamColor(
      team,
      this.perspective?.yourTeam() ?? null,
      this.perspective?.mode() ?? 'fixed',
    );
  });
}
