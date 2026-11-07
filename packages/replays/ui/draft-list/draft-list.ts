import { Component, inject, input } from '@angular/core';
import { CellTemplate, DataGrid, GridColumn, GridHeader, GridRowElement, RowTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { teamColor } from '../../model';
import { TeamPerspective } from '../team-theme/team-perspective';
import type { DraftStep } from './draft-steps';

/**
 * A replay's draft (presentational, on the data grid): its bans and picks in order, each in its
 * team's colour (from the `TeamPerspective` above it, as `hrsTeam` would) with the hero and, for
 * a pick, the player.
 */
@Component({
  selector: 'hrs-draft-list',
  imports: [CellTemplate, DataGrid, GridColumn, GridHeader, GridRowElement, HeroMinimapIcon, RowTemplate],
  templateUrl: './draft-list.html',
  styleUrl: './draft-list.scss',
})
export class DraftList {
  readonly steps = input.required<readonly DraftStep[]>();

  private readonly perspective = inject(TeamPerspective, { optional: true });
  protected readonly byKey = (step: DraftStep) => step.key;
  protected readonly themeOf = (step: DraftStep) =>
    step.team === null
      ? null
      : teamColor(step.team, this.perspective?.yourTeam() ?? null, this.perspective?.mode() ?? 'fixed');
}
