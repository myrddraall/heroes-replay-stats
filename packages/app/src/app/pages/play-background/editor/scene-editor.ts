import { Component, computed, inject, input } from '@angular/core';
import { BACKGROUND_SCENE } from '../../../scenes/play-background/background-design.tokens';
import { Editor } from './editor';
import { OVERRIDE_SHOWN } from '../properties/override-shown';
import { EditorLayout } from './editor-layout';
import { selectParentWhenGone } from './select-parent-when-gone';
import { EditorUiStore } from './editor-ui.store';
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
    // A row marked overridden takes you to the level that wins over it.
    {
      provide: OVERRIDE_SHOWN,
      useFactory: () => {
        const editor = inject(Editor);
        return (level: string) => editor.showLayer(level);
      },
    },
    {
      provide: BACKGROUND_SCENE,
      useFactory: () => {
        const store = inject(SceneEditorStore);
        const ui = inject(EditorUiStore);
        return {
          planets: store.scenePlanets,
          sky: store.sceneSky,
          lights: store.sceneLights,
          tint: store.sceneTint,
          key: store.scene,
          random: store.sets,
          camera: store.viewCamera,
          // An anchored sky moves with the view's camera, or (not following it) with the scene's.
          skyFollow: computed(() => (ui.skyFollows() ? null : store.sceneCamera())),
          // The light selected's beams, with the markers (none in a screenshot or the library's preview).
          beams: computed(() => (ui.markers() !== 'none' && !ui.screenshot() && !ui.browsing() ? store.beams() : [])),
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
    selectParentWhenGone(inject(Editor));
    inject(SceneEditorStore).showScene(this.scene);
  }
}
