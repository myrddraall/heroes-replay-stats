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
  templateUrl: './replays-page.html',
  styleUrl: './replays-page.scss',
})
export class ReplaysPage {
  protected readonly imports = inject(ReplayImportJobStore);
  protected readonly replays = inject(ReplayService);

  protected message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
