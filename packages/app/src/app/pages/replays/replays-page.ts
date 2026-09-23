import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../empty-state';

@Component({
  selector: 'hrs-replays-page',
  imports: [EmptyState, MatButtonModule, RouterLink],
  template: `
    <h1>Replays</h1>
    <hrs-empty-state icon="history" title="No replays yet">
      Import a few .StormReplay files and they will be parsed, stored locally and listed here.
      <br /><a mat-stroked-button routerLink="/import" class="cta">Import replays</a>
    </hrs-empty-state>
  `,
  styles: `
    .cta {
      margin-top: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplaysPage {}
