import { Component, inject } from '@angular/core';
import { ImportJobs } from './import-jobs';
import { ImportPageStore } from './import-page.store';
import { Layout } from '../../layout/layout';

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
