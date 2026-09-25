import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import type { ReplayRecord } from '@myrddraall/heroprotocol-db/model';
import { ReplaysStore } from '../../data/replays/replays.store';
import { injectPlatform } from '../../platform/platform';

@Component({
  selector: 'hrs-import-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatListModule],
  template: `
    <h1>Import replays</h1>
    <p class="lead">
      Replays are parsed in the background and kept on this device only.
      @if (platform.kind === 'desktop') {
        The desktop app can watch your Heroes of the Storm replay folder.
      }
    </p>
    <button mat-flat-button class="hrs-cta" (click)="pick()" [disabled]="busy()">
      <mat-icon class="material-symbols-outlined">upload_file</mat-icon>
      {{ busy() ? 'Importing…' : 'Choose .StormReplay files' }}
    </button>
    @if (error(); as message) {
      <p class="error">{{ message }}</p>
    }
    @if (imported().length > 0) {
      <mat-list class="imported">
        @for (replay of imported(); track replay.id) {
          <mat-list-item>
            <mat-icon matListItemIcon class="material-symbols-outlined">check_circle</mat-icon>
            <span matListItemTitle>{{ replay.map }}</span>
            <span matListItemLine>{{ replay.mode }} · {{ replay.playedAt | date: 'medium' }}</span>
          </mat-list-item>
        }
      </mat-list>
    }
  `,
  styles: `
    .lead {
      color: var(--mat-sys-on-surface-variant);
      max-width: 60ch;
    }
    .imported {
      margin-top: 16px;
      border: 1px solid var(--hrs-border);
      border-radius: 12px;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportPage {
  protected readonly platform = injectPlatform();
  protected readonly replays = inject(ReplaysStore);
  protected readonly imported = signal<readonly ReplayRecord[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async pick(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const done = await this.replays.import();
      if (done.length > 0) this.imported.update((prev) => [...done, ...prev]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.busy.set(false);
    }
  }
}
