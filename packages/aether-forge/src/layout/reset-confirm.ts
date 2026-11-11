import { Component, inject } from '@angular/core';
import { Editor } from '../editing/editor';
import { EditorUiStore } from './editor-ui.store';

/**
 * The reset of everything in what is open, asked for from the view's menu, to confirm (container,
 * on the page's UI store and the `Editor` in effect).
 */
@Component({
  selector: 'forge-reset-confirm',
  templateUrl: './reset-confirm.html',
  styleUrl: './reset-confirm.scss',
})
export class ResetConfirm {
  protected readonly ui = inject(EditorUiStore);
  protected readonly editor = inject(Editor);
}
