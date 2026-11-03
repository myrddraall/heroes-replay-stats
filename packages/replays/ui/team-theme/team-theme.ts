import { computed, Directive, inject, input } from '@angular/core';
import type { Team } from '@myrddraall/heroprotocol-db';
import { teamColor } from '../../model';
import { TeamPerspective } from './team-perspective';

/**
 * Themes an element as a team: `<tr [hrsTeam]="player.team">`. Sets its theme, `data-theme="blue"`
 * or `"red"` (the theme's team themes, which re-tint everything inside), chosen by the
 * `TeamPerspective` above it. A null team leaves the element in the theme around it.
 */
@Directive({
  selector: '[hrsTeam]',
  host: {
    '[attr.data-theme]': 'color()',
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
