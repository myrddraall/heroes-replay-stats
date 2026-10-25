import { Component, inject } from '@angular/core';
import { DraftDesignStore } from '../draft/draft-design.store';
import { MatIcon } from '@angular/material/icon';
import { ViewMenu } from './view-menu';

/**
 * The editor's bar while something is open (container, on the page's stores): Undo and Redo (the
 * draft's last changes), Discard (the published design again), Save (the draft published: the site
 * shows it), and the view's menu.
 */
@Component({
  selector: 'forge-editor-bar',
  imports: [ViewMenu, MatIcon],
  templateUrl: './editor-bar.html',
  styleUrl: './editor-bar.scss',
})
export class EditorBar {
  protected readonly draft = inject(DraftDesignStore);
}
