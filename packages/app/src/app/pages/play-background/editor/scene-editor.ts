import { Component, inject, input, output } from '@angular/core';
import { BACKGROUND_SCENE } from '../../../scenes/play-background/background-design.tokens';
import { Editor } from './editor';
import { EditorLayout } from './editor-layout';
import { SceneEditorStore } from './scene-editor.store';
import { SceneHeader } from './scene-header';

/**
 * The scene editor (container): provides its store as the `Editor` the panels under it use and as
 * the scene the background under it shows, its planet the one `planet` says (the URL's).
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
        return { planets: store.scenePlanets, sky: store.sceneSky, tint: store.sceneTint };
      },
    },
  ],
  templateUrl: './scene-editor.html',
})
export class SceneEditor {
  /** The scene's planet, by id (none: the random sets). */
  readonly planet = input<string>();
  /** A planet chosen, by id ('': the random sets), for the URL. */
  readonly planetChange = output<string>();

  constructor() {
    inject(SceneEditorStore).showPlanet(this.planet);
  }
}
