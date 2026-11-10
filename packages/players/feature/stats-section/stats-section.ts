import { Component, inject, input } from '@angular/core';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import type { PlayerStatSectionId } from '../../model';
import { PlayerBreakdown } from '../../ui';
import { StatsSectionStore } from './stats-section.store';

/**
 * One stats section of the player (container): `/replays/players/<id>/stats/<section>`. A match's
 * stat table, a row for each hero, role, map or mode.
 */
@Component({
  selector: 'hrs-player-stats-section',
  imports: [EmptyState, Layout, PlayerBreakdown],
  templateUrl: './stats-section.html',
  providers: [StatsSectionStore],
})
export class StatsSection {
  /** From the route's data. */
  readonly section = input.required<PlayerStatSectionId>();
  protected readonly store = inject(StatsSectionStore);

  constructor() {
    this.store.show(this.section);
  }
}
