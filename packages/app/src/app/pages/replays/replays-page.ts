import { Component, inject } from '@angular/core';
import { ReplayList } from './replay-list';
import { ReplaysPageStore } from './replays-page.store';
import { Layout } from '../../layout/layout';

/** The stored replays (container). */
@Component({
  selector: 'hrs-replays-page',
  imports: [Layout, ReplayList],
  templateUrl: './replays-page.html',
  providers: [ReplaysPageStore],
})
export class ReplaysPage {
  protected readonly store = inject(ReplaysPageStore);
}
