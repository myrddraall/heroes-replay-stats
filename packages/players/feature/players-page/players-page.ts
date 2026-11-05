import { Component, inject } from '@angular/core';
import { PlayersPageStore } from './players-page.store';
import { PlayersTable } from '../../ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';

/** Everyone in the stored replays (container), and the search that narrows them. */
@Component({
  selector: 'hrs-players-page',
  imports: [Layout, PlayersTable],
  templateUrl: './players-page.html',
  providers: [PlayersPageStore],
})
export class PlayersPage {
  protected readonly store = inject(PlayersPageStore);
}
