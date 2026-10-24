import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Editor } from './editor';
import { EditorUiStore, type MarkerMode } from './editor-ui.store';

/**
 * The view's options behind a gear (container, on the page's UI store and the `Editor` in
 * effect): the names over the bodies, which markers the view shows, the screenshot mode, everything in what is open reset
 * (asked for here, confirmed by the reset confirmation), all the saved design cleared (confirmed
 * likewise), and the app's settings, in a dialog over the editor.
 */
@Component({
  selector: 'hrs-view-menu',
  imports: [MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip],
  templateUrl: './view-menu.html',
  styleUrl: './view-menu.scss',
})
export class ViewMenu {
  protected readonly ui = inject(EditorUiStore);
  protected readonly editor = inject(Editor);
  private readonly dialog = inject(MatDialog);
  protected readonly markerModes: readonly { readonly id: MarkerMode; readonly label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'selected', label: 'Selected' },
    { id: 'none', label: 'None' },
  ];

  /** The settings, in a dialog (loaded as it is first opened). */
  protected async openSettings(): Promise<void> {
    const { SettingsDialog } = await import('../../settings/settings-dialog');
    this.dialog.open(SettingsDialog, { ariaLabel: 'Settings', autoFocus: 'dialog', width: '760px', maxWidth: '95vw', maxHeight: '90vh' });
  }
}
