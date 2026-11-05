import { Component, inject } from '@angular/core';
import { Editor } from '../editing/editor';
import { EditorUiStore } from '../layout/editor-ui.store';
import { OverlayProperties } from '../overlays/overlay-properties';

/** The overlay selected in the tree (container, on the `Editor` in effect): its properties. */
@Component({
  selector: 'forge-overlay-panel',
  imports: [OverlayProperties],
  templateUrl: './overlay-panel.html',
  styleUrl: './body-panel.scss',
})
export class OverlayPanel {
  protected readonly editor = inject(Editor);
  private readonly ui = inject(EditorUiStore);

  protected open(id: string): void {
    this.ui.open({ kind: 'style', id });
  }
}
