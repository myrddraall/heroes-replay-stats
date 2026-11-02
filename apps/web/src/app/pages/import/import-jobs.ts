import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ImportJob, ImportOverall } from '../../data/import/replay-import-job.store';

/** The replay imports (presentational): overall progress, and each job with its analysers. */
@Component({
  selector: 'hrs-import-jobs',
  imports: [
    DecimalPipe,
    PercentPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatTooltipModule,
  ],
  templateUrl: './import-jobs.html',
  styleUrl: './import-jobs.scss',
})
export class ImportJobs {
  readonly jobs = input.required<readonly ImportJob[]>();
  readonly overall = input.required<ImportOverall>();
  /** Running in the desktop app, which can watch the replay folder. */
  readonly desktop = input(false);
  /** The user asked to import replays. */
  readonly importRequested = output<void>();
  /** The user asked to clear the finished jobs. */
  readonly clearFinished = output<void>();
  /** The user dismissed a job: its id. */
  readonly dismiss = output<string>();

  /** The file name without its extension, for display; the full name is kept in a tooltip. */
  protected displayName(fileName: string): string {
    return fileName.replace(/\.[^./]+$/, '');
  }

  /** What the job is doing, in words; a queued database write reads as waiting. */
  protected phaseLabel(job: ImportJob): string {
    if (job.store?.state === 'waiting') return 'waiting for database';
    return job.phase ?? 'queued';
  }

  protected icon(status: string): string {
    return (
      {
        queued: 'schedule',
        running: 'progress_activity',
        ready: 'check',
        complete: 'check_circle',
        failed: 'error',
      }[status] ?? 'description'
    );
  }

  protected analyserIcon(state: string): string {
    return (
      {
        queued: 'schedule',
        running: 'progress_activity',
        done: 'check_circle',
        cached: 'check_circle',
        failed: 'error',
      }[state] ?? 'circle'
    );
  }
}
