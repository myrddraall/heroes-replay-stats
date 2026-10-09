import { Component, inject } from '@angular/core';
import { ImportJobs } from './import-jobs';
import { ImportPageStore } from './import-page.store';

/** Importing replays (container). */
@Component({
  selector: 'hrs-import-page',
  imports: [ImportJobs],
  templateUrl: './import-page.html',
  providers: [ImportPageStore],
})
export class ImportPage {
  protected readonly store = inject(ImportPageStore);
}
