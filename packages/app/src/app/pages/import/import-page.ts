import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { injectPlatform } from '../../platform/platform';
import type { PickedReplay } from '../../platform/platform';

/** Picks replay files through the platform seam; ingestion itself arrives with the next step. */
@Component({
  selector: 'hrs-import-page',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatListModule],
  template: `
    <h1>Import replays</h1>
    <p class="lead">
      Replays are parsed in the background and kept on this device only.
      @if (platform.kind === 'desktop') {
        The desktop app can watch your Heroes of the Storm replay folder.
      }
    </p>
    <button mat-flat-button (click)="pick()" [disabled]="busy()">
      <mat-icon class="material-symbols-outlined">upload_file</mat-icon>
      Choose .StormReplay files
    </button>
    @if (picked().length > 0) {
      <mat-list class="picked">
        @for (file of picked(); track file.name) {
          <mat-list-item>
            <mat-icon matListItemIcon class="material-symbols-outlined">description</mat-icon>
            <span matListItemTitle>{{ file.name }}</span>
            <span matListItemLine
              >{{ file.bytes.byteLength / 1024 | number: '1.0-0' }} KB{{
                file.path ? ' · ' + file.path : ''
              }}</span
            >
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
    .picked {
      margin-top: 16px;
      border: 1px solid var(--hrs-border);
      border-radius: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportPage {
  protected readonly platform = injectPlatform();
  protected readonly picked = signal<readonly PickedReplay[]>([]);
  protected readonly busy = signal(false);

  protected async pick(): Promise<void> {
    this.busy.set(true);
    try {
      const files = await this.platform.pickReplays();
      if (files.length > 0) this.picked.update((prev) => [...prev, ...files]);
    } finally {
      this.busy.set(false);
    }
  }
}
