import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatchDataService } from '../../data';

/**
 * Asks before clearing all match data (opened from the settings menu), then clears it: every
 * imported replay and its stats. It stays open while that runs and closes when it is done.
 */
@Component({
  selector: 'hrs-clear-match-data-dialog',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatProgressBar,
  ],
  templateUrl: './clear-match-data-dialog.html',
})
export class ClearMatchDataDialog {
  private readonly data = inject(MatchDataService);
  private readonly dialog = inject<MatDialogRef<ClearMatchDataDialog>>(MatDialogRef);
  protected readonly clearing = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async clear(): Promise<void> {
    this.clearing.set(true);
    this.error.set(null);
    this.dialog.disableClose = true;
    try {
      await this.data.clear();
      this.dialog.close();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      this.clearing.set(false);
      this.dialog.disableClose = false;
    }
  }
}
