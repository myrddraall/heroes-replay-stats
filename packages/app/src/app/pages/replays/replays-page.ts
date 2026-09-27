import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { EmptyState } from '../empty-state';

@Component({
  selector: 'hrs-replays-page',
  imports: [EmptyState, MatButtonModule],
  template: `
    <h1>Replays</h1>
    <hrs-empty-state icon="history" title="No replays yet">
      Import a few .StormReplay files and they will be parsed, stored locally and listed here.
      <br /><button mat-stroked-button class="cta" (click)="imports.import()">
        Import replays
      </button>
    </hrs-empty-state>
  `,
  styles: `
    .cta {
      margin-top: 16px;
    }
  `,
})
export class ReplaysPage {
  protected readonly imports = inject(ReplayImportJobStore);
}
