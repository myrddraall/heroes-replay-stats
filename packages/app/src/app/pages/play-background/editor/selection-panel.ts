import { Component, inject } from '@angular/core';
import { DraftDesignStore } from '../draft-design.store';
import { BodyProperties } from './body-properties';
import { Editor } from './editor';
import { MaterialProperties } from './material-properties';
import { SceneEditorStore } from './scene-editor.store';
import { SceneProperties } from './scene-properties';
import { TintSection } from './tint-section';

/**
 * The properties of what is selected in the tree (container, on the `Editor` in effect: the scene
 * editor's or the library editor's): the scene's own (the scene editor's only), a sky's (a tint
 * over all of it), a body's or a material's, each as its presentational properties show them,
 * what they change going back to the editor, which writes it to the layer it edits.
 */
@Component({
  selector: 'hrs-selection-panel',
  imports: [TintSection, SceneProperties, BodyProperties, MaterialProperties],
  templateUrl: './selection-panel.html',
  styleUrl: './selection-panel.scss',
})
export class SelectionPanel {
  protected readonly editor = inject(Editor);
  /** The scene editor, where the scene's own properties come from (none in the library). */
  protected readonly scene = inject(SceneEditorStore, { optional: true });
  protected readonly draft = inject(DraftDesignStore);
}
