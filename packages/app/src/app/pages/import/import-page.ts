import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
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
  ],
  template: `
    <h1>Import replays</h1>
    <p class="lead">
      Replays are parsed in the background and kept on this device only.
      @if (platform.kind === 'desktop') {
        The desktop app can watch your Heroes of the Storm replay folder.
      }
    </p>
    <div class="actions">
      <button mat-flat-button class="hrs-cta" (click)="imports.import()">
        <mat-icon class="material-symbols-outlined">upload_file</mat-icon>
        Choose .StormReplay files
      </button>
      @if (imports.overall().done + imports.overall().failed > 0) {
        <button mat-button (click)="imports.clearFinished()">Clear finished</button>
      }
    </div>

    @if (imports.overall().total > 0) {
      <section class="overall" aria-live="polite">
        <div class="overall__line">
          <span>
            @if (imports.overall().active) {
              Importing {{ imports.overall().done + imports.overall().running }} of
              {{ imports.overall().total }}
            } @else {
              {{ imports.overall().done }} imported
              @if (imports.overall().failed > 0) {
                · {{ imports.overall().failed }} failed
              }
            }
          </span>
          <span>{{ imports.overall().progress | percent: '1.0-0' }}</span>
        </div>
        <mat-progress-bar
          [mode]="imports.overall().active ? 'buffer' : 'determinate'"
          [value]="imports.overall().progress * 100"
        />
      </section>

      <mat-accordion multi class="jobs">
        @for (job of imports.jobs(); track job.id) {
          <mat-expansion-panel [class]="'job job--' + job.status">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="material-symbols-outlined job__icon">{{
                  icon(job.status)
                }}</mat-icon>
                {{ job.fileName }}
              </mat-panel-title>
              <mat-panel-description>
                <span class="job__phase">{{ job.error ?? job.phase ?? 'queued' }}</span>
                <span>{{ job.progress | percent: '1.0-0' }}</span>
              </mat-panel-description>
            </mat-expansion-panel-header>
            <mat-progress-bar mode="determinate" [value]="job.progress * 100" />
            @if (job.analysers.length > 0) {
              <ul class="analysers">
                @for (a of job.analysers; track a.id) {
                  <li [class]="'analyser analyser--' + a.state">
                    <mat-icon class="material-symbols-outlined analyser__icon" inline>{{
                      analyserIcon(a.state)
                    }}</mat-icon>
                    <span class="analyser__id">{{ a.id }}</span>
                    <span class="analyser__mode">{{ a.mode }}</span>
                    <span class="analyser__state">
                      {{ a.error ?? a.state }}
                      @if (a.progress !== null && a.state === 'running') {
                        · {{ a.progress | percent: '1.0-0' }}
                      }
                      @if (a.ms !== null && a.state === 'done') {
                        · {{ a.ms | number: '1.0-0' }} ms
                      }
                    </span>
                  </li>
                }
              </ul>
            }
            <div class="job__footer">
              <span
                >{{ job.bytes / 1024 | number: '1.0-0' }} KB{{
                  job.replayId ? ' · ' + job.replayId.slice(0, 12) : ''
                }}</span
              >
              <button mat-button (click)="imports.dismiss(job.id)">Dismiss</button>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>
    }
  `,
  styles: `
    .lead {
      color: var(--mat-sys-on-surface-variant);
      max-width: 60ch;
    }
    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .overall {
      margin: 20px 0 12px;
    }
    .overall__line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      color: var(--mat-sys-on-surface-variant);
    }
    .jobs {
      display: block;
    }
    .job__icon {
      margin-right: 8px;
    }
    .job--complete .job__icon {
      color: var(--hrs-blue-soft);
    }
    .job--failed .job__icon,
    .job--failed .job__phase {
      color: var(--mat-sys-error);
    }
    mat-panel-description {
      justify-content: space-between;
      gap: 12px;
    }
    .job__phase {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .analysers {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .analyser {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: center;
      font: var(--mat-sys-body-small);
    }
    .analyser__id {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .analyser__mode,
    .analyser__state {
      color: var(--mat-sys-on-surface-variant);
    }
    .analyser--done .analyser__icon,
    .analyser--cached .analyser__icon {
      color: var(--hrs-blue-soft);
    }
    .analyser--failed .analyser__icon,
    .analyser--failed .analyser__state {
      color: var(--mat-sys-error);
    }
    .job__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ImportPage {
  protected readonly platform = injectPlatform();
  protected readonly imports = inject(ReplayImportJobStore);

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
