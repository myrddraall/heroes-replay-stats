import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ReplaysStore } from '../../data/replays/replays.store';
import { EmptyState } from '../empty-state';

@Component({
  selector: 'hrs-replays-page',
  imports: [EmptyState, MatButtonModule],
  template: `
    <h1>Replays</h1>
    <hrs-empty-state icon="history" title="No replays yet">
      Import a few .StormReplay files and they will be parsed, stored locally and listed here.
      <br /><button mat-stroked-button class="cta" (click)="replays.import()">
        Import replays
      </button>
    </hrs-empty-state>
  `,
  styles: `
    .cta {
      margin-top: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplaysPage {
  protected readonly replays = inject(ReplaysStore);
}
