import { Component, computed, inject, input } from '@angular/core';
import { SCENE_SOURCE } from '@myrddraall/heroes-replay-stats-aether/view';
import { receivedLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import { Editor } from '../editing/editor';
import { OVERRIDE_SHOWN } from '../controls/rows/override-shown';
import { EditorLayout } from '../layout/editor-layout';
import { selectParentWhenGone } from '../tree/select-parent-when-gone';
import { EditorUiStore } from '../layout/editor-ui.store';
import { editorAids } from '../viewport/marker-aids';
import { SceneEditorStore } from './scene-editor.store';
import { SceneHeader } from './scene-header';

/**
 * The scene editor (container): provides its store as the `Editor` the panels under it use and as
 * the scene the background under it shows: the scene `scene` says (the URL's).
 */
@Component({
  selector: 'forge-scene-editor',
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
      provide: SCENE_SOURCE,
      useFactory: () => {
        const store = inject(SceneEditorStore);
        const ui = inject(EditorUiStore);
        return {
          planets: store.scenePlanets,
          sky: store.sceneSky,
          // (With the groups' that light the whole scene.)
          lights: computed(() => [
            ...store.sceneLights(),
            ...store
              .placedGroups()
              .flatMap((g) => g.lights.filter((l) => l.out === 'scene').map(receivedLight)),
          ]),
          tint: store.sceneTint,
          key: store.scene,
          random: store.sets,
          camera: store.viewCamera,
          // Inside a planet, a moon or an overlay: the rest of the scene dimmed; a light selected,
          // what it doesn't light.
          dim: computed(() => (store.dimming() ? 0.35 : 1)),
          // An anchored sky moves with the view's camera, or (not following it) with the scene's.
          skyFollow: computed(() => (ui.skyFollows() ? null : store.sceneCamera())),
          // The light selected's beams, and the markers' dots and lines (see `editorAids`).
          beams: computed(() => editorAids(store, ui)),
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
