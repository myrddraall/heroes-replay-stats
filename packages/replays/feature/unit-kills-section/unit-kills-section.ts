import { Component, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { UnitKillTables } from '../../ui';
import { UnitKillsSectionStore } from './unit-kills-section.store';

/**
 * The replay's unit kills (container): each player's (`/replays/matches/<id>/players/unit-kills`)
 * or each team's (`…/teams/unit-kills`).
 */
@Component({
  selector: 'hrs-unit-kills-section',
  imports: [Layout, MatProgressBar, UnitKillTables],
  templateUrl: './unit-kills-section.html',
  providers: [UnitKillsSectionStore],
})
export class UnitKillsSection {
  /** From the route: whose kills. */
  readonly table = input.required<'players' | 'teams'>();
  protected readonly store = inject(UnitKillsSectionStore);
}
