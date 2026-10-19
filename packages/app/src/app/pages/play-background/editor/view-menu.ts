import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Editor } from './editor';
import { EditorUiStore } from './editor-ui.store';

/**
 * The view's options behind a gear (container, on the page's UI store and the `Editor` in
 * effect): the names over the bodies, the screenshot mode, everything in what is open reset
 * (asked for here, confirmed by the reset confirmation), all the saved design cleared (confirmed
 * likewise).
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
}
