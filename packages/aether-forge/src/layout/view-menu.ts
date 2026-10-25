import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Editor } from '../editing/editor';
import { FORGE_OPTIONS } from '../forge-options';
import { EditorUiStore, type MarkerMode } from './editor-ui.store';

/**
 * The view's options behind a gear (container, on the page's UI store and the `Editor` in
 * effect): the names over the bodies, which markers the view shows, the frame stats, whether an
 * anchored sky follows the camera looked through, the screenshot mode, everything in what is open reset
 * (asked for here, confirmed by the reset confirmation), all the saved design cleared (confirmed
 * likewise), and the app's settings, where the app gives a way to open them.
 */
@Component({
  selector: 'forge-view-menu',
  imports: [MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip],
  templateUrl: './view-menu.html',
  styleUrl: './view-menu.scss',
})
export class ViewMenu {
  protected readonly ui = inject(EditorUiStore);
  protected readonly editor = inject(Editor);
  /** Opens the app's settings (none: the app gives no way to). */
  protected readonly openSettings = inject(FORGE_OPTIONS).openSettings;
  protected readonly markerModes: readonly { readonly id: MarkerMode; readonly label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'selected', label: 'Selected' },
    { id: 'none', label: 'None' },
  ];

}
