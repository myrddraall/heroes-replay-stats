import { Component, inject } from '@angular/core';
import { PlayersPageStore } from './players-page.store';
import { PlayersTable } from './players-table';
import { Layout } from '../../layout/layout';

/** Everyone in the stored replays (container). */
@Component({
  selector: 'hrs-players-page',
  imports: [Layout, PlayersTable],
  templateUrl: './players-page.html',
  providers: [PlayersPageStore],
})
export class PlayersPage {
  protected readonly store = inject(PlayersPageStore);
}
