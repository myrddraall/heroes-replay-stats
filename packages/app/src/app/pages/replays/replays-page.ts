import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { ReplayService } from '../../data/replays/replay.service';
import { EmptyState } from '../empty-state';
import { ReplayListItem } from './replay-list-item';

@Component({
  selector: 'hrs-replays-page',
  imports: [EmptyState, MatButtonModule, MatProgressBarModule, ReplayListItem],
  template: `
    <header class="head">
      <h1>Replays</h1>
      @if (replays.replays().length > 0) {
        <span class="count"
          >{{ replays.replays().length }}
          {{ replays.replays().length === 1 ? 'replay' : 'replays' }}</span
        >
      }
    </header>
    @if (replays.error(); as error) {
      <p class="error" role="alert">The replay database could not be read: {{ message(error) }}</p>
    } @else if (!replays.loaded()) {
      <mat-progress-bar mode="indeterminate" aria-label="Loading replays" />
    } @else if (replays.replays().length === 0) {
      <hrs-empty-state icon="history" title="No replays yet">
        Import a few .StormReplay files and they will be parsed, stored locally and listed here.
        <br /><button mat-stroked-button class="cta" (click)="imports.import()">
          Import replays
        </button>
      </hrs-empty-state>
    } @else {
      <ul class="list">
        @for (replay of replays.replays(); track replay.id) {
          <li><hrs-replay-list-item [replay]="replay" /></li>
        }
      </ul>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .count {
      color: var(--mat-sys-on-surface-variant);
    }
    .cta {
      margin-top: 16px;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class ReplaysPage {
  protected readonly imports = inject(ReplayImportJobStore);
  protected readonly replays = inject(ReplayService);

  protected message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
