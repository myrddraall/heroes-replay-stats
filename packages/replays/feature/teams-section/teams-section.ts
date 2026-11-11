import { Component, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { TeamStats } from '../../ui';
import { TeamsSectionStore } from './teams-section.store';

/** One of the replay's team stats tables (container): `/replays/matches/<id>/teams/<group>`. */
@Component({
  selector: 'hrs-teams-section',
  imports: [EmptyState, Layout, MatProgressBar, TeamStats],
  templateUrl: './teams-section.html',
  providers: [TeamsSectionStore],
})
export class TeamsSection {
  /** From the route: the table's group (combat, xp, structures, camps). */
  readonly group = input.required<string>();
  protected readonly store = inject(TeamsSectionStore);
}
