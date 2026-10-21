import { Component, inject } from '@angular/core';
import { DraftDesignStore } from '../draft-design.store';
import { EditorUiStore } from './editor-ui.store';
import { RANDOM_SETS } from './open-target';

/**
 * Clearing all the saved and drafted design, asked for from the view's menu, to confirm
 * (container, on the page's UI store and the draft): once cleared, the random sets are opened.
 */
@Component({
  selector: 'hrs-clear-confirm',
  templateUrl: './clear-confirm.html',
  styleUrl: './reset-confirm.scss',
})
export class ClearConfirm {
  protected readonly ui = inject(EditorUiStore);
  private readonly draft = inject(DraftDesignStore);

  protected clear(): void {
    this.draft.clearAll();
    this.ui.confirmClear(false);
    this.ui.show(RANDOM_SETS);
  }
}
