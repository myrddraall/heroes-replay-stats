import { booleanAttribute, computed, Directive, inject, input } from '@angular/core';
import type { Team } from '@myrddraall/heroprotocol-db';
import { playerTheme, teamColor } from '../../model';
import { TeamPerspective } from './team-perspective';

/**
 * Themes an element as a team: `<tr [hrsTeam]="player.team">`, or a component composing it as a
 * host directive (`hrs-match-team`, `hrs-player-cell`). Sets its theme, `theme="blue"`
 * or `"red"` (the theme's team themes, which re-tint everything inside), chosen by the
 * `TeamPerspective` above it. With `hrsTeamSelf`, the user's own: `blue-self` or `red-self` (the
 * game's self green on blue, gold on red). A null team leaves the element in the theme around it.
 */
@Directive({
  selector: '[hrsTeam]',
  host: {
    '[attr.theme]': 'color()',
  },
})
export class TeamTheme {
  readonly hrsTeam = input<Team | null>(null);
  /** The element is the user's own (their player): their theme on their team's side. */
  readonly hrsTeamSelf = input(false, { transform: booleanAttribute });
  private readonly perspective = inject(TeamPerspective, { optional: true });

  protected readonly color = computed(() => {
    const team = this.hrsTeam();
    if (team === null) return null;
    const color = teamColor(
      team,
      this.perspective?.yourTeam() ?? null,
      this.perspective?.mode() ?? 'fixed',
    );
    return playerTheme(color, this.hrsTeamSelf());
  });
}
