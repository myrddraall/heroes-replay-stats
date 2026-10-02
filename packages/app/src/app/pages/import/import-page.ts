import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReplayImportJobStore, type ImportJob } from '../../data/import/replay-import-job.store';
import { injectPlatform } from '../../platform/platform';

@Component({
  selector: 'hrs-import-page',
  imports: [
    DecimalPipe,
    PercentPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatTooltipModule,
  ],
  templateUrl: './import-page.html',
  styleUrl: './import-page.scss',
})
export class ImportPage {
  protected readonly platform = injectPlatform();
  protected readonly imports = inject(ReplayImportJobStore);

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
