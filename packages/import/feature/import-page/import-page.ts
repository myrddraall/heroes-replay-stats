import { Component, inject } from '@angular/core';
import { ImportJobs } from '../../ui';
import { ImportPageStore } from './import-page.store';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';

/** Importing replays (container). */
@Component({
  selector: 'hrs-import-page',
  imports: [Layout, ImportJobs],
  templateUrl: './import-page.html',
  providers: [ImportPageStore],
})
export class ImportPage {
  protected readonly store = inject(ImportPageStore);
}
