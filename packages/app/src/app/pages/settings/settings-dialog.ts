import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { SettingsPanel } from './settings-panel';

/** The settings in a dialog (opened from the Background editor, which stays as it is under it). */
@Component({
  selector: 'hrs-settings-dialog',
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, SettingsPanel],
  template: `
    <mat-dialog-content><hrs-settings-panel /></mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button mat-button type="button" mat-dialog-close>Close</button></mat-dialog-actions
    >
  `,
})
export class SettingsDialog {}
