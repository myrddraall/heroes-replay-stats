import { Component, inject } from '@angular/core';
import { MatchFilters, ReplayList } from '../../ui';
import { ReplaysPageStore } from './replays-page.store';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';

/** The stored replays (container), and the filter that narrows them. */
@Component({
  selector: 'hrs-replays-page',
  imports: [Layout, MatchFilters, ReplayList],
  templateUrl: './replays-page.html',
  providers: [ReplaysPageStore],
})
export class ReplaysPage {
  protected readonly store = inject(ReplaysPageStore);
}
