import { Component, computed, inject } from '@angular/core';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { RECORD_STATS } from '../../model';
import { playerColumns, PlayerRecords, toPlayerRecordRows } from '../../ui';
import { PlayerPageStore } from '../player-page';

const COLUMNS = playerColumns(RECORD_STATS);

/** The player's records (container), from their page's store: `/replays/players/<id>/records`. */
@Component({
  selector: 'hrs-player-records-section',
  imports: [Layout, PlayerRecords],
  template: `<hrs-layout><hrs-player-records [rows]="rows()" /></hrs-layout>`,
})
export class RecordsSection {
  private readonly store = inject(PlayerPageStore);
  protected readonly rows = computed(() =>
    toPlayerRecordRows(this.store.games(), COLUMNS, this.store.heroes()),
  );
}
