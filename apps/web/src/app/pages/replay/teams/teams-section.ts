import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { EmptyState } from '../../empty-state';
import { TeamStats } from './team-stats';
import { TeamsSectionStore } from './teams-section.store';

/** The replay's team stats (container): `/replays/<id>/teams`. */
@Component({
  selector: 'hrs-teams-section',
  imports: [EmptyState, Layout, MatProgressBar, TeamStats],
  templateUrl: './teams-section.html',
  providers: [TeamsSectionStore],
})
export class TeamsSection {
  protected readonly store = inject(TeamsSectionStore);
}
