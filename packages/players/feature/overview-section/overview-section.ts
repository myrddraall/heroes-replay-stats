import { Component, computed, inject } from '@angular/core';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { PlayerOverview, toPlayerOverview } from '../../ui';
import { PlayerPageStore } from '../player-page';

/** The player's matches at a glance (container), from their page's store: `/replays/players/<id>/overview`. */
@Component({
  selector: 'hrs-player-overview-section',
  imports: [Layout, PlayerOverview],
  template: `<hrs-layout><hrs-player-overview [overview]="overview()" /></hrs-layout>`,
})
export class OverviewSection {
  private readonly store = inject(PlayerPageStore);
  protected readonly overview = computed(() =>
    toPlayerOverview(this.store.games(), this.store.heroes()),
  );
}
