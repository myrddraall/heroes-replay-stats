import { Component, inject, input } from '@angular/core';
import { BACKGROUND_SCENE } from '../../../scenes/play-background/background-design.tokens';
import { Editor } from './editor';
import { EditorLayout } from './editor-layout';
import { SceneEditorStore } from './scene-editor.store';
import { SceneHeader } from './scene-header';

/**
 * The scene editor (container): provides its store as the `Editor` the panels under it use and as
 * the scene the background under it shows: the scene `scene` says (the URL's).
 */
@Component({
  selector: 'hrs-scene-editor',
  imports: [EditorLayout, SceneHeader],
  providers: [
    SceneEditorStore,
    { provide: Editor, useExisting: SceneEditorStore },
    {
      provide: BACKGROUND_SCENE,
      useFactory: () => {
        const store = inject(SceneEditorStore);
        return {
          planets: store.scenePlanets,
          sky: store.sceneSky,
          tint: store.sceneTint,
          key: store.scene,
          random: store.sets,
        };
      },
    },
  ],
  templateUrl: './scene-editor.html',
})
export class SceneEditor {
  /** The scene, by id ('': the random sets'). */
  readonly scene = input.required<string>();

  constructor() {
    inject(SceneEditorStore).showScene(this.scene);
  }
}
