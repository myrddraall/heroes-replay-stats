import { Component, inject } from '@angular/core';
import { DraftDesignStore } from '../draft-design.store';
import { ViewMenu } from './view-menu';

/**
 * The editor's bar while something is open (container, on the page's stores): Discard (the
 * published design again), Save (the draft published: the site shows it), and the view's menu.
 */
@Component({
  selector: 'hrs-editor-bar',
  imports: [ViewMenu],
  templateUrl: './editor-bar.html',
  styleUrl: './editor-bar.scss',
})
export class EditorBar {
  protected readonly draft = inject(DraftDesignStore);
}
