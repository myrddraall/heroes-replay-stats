import { Component, inject, input } from '@angular/core';
import { BACKGROUND_SCENE } from '../../../scenes/play-background/background-design.tokens';
import { AssetEditorStore } from './asset-editor.store';
import { Editor } from './editor';
import { EditorLayout } from './editor-layout';
import type { AssetTarget } from './open-target';

/**
 * The asset editor (container): provides its store as the `Editor` the panels under it use and,
 * as the scene the background under it shows, the preview stage: the asset `asset` says (the
 * URL's), on the stage's own sky.
 */
@Component({
  selector: 'hrs-asset-editor',
  imports: [EditorLayout],
  providers: [
    AssetEditorStore,
    { provide: Editor, useExisting: AssetEditorStore },
    {
      provide: BACKGROUND_SCENE,
      useFactory: () => {
        const store = inject(AssetEditorStore);
        return {
          planets: store.stagePlanets,
          sky: store.stageSky,
          tint: store.stageTint,
          backdrop: store.stageBackdrop,
        };
      },
    },
  ],
  templateUrl: './asset-editor.html',
})
export class AssetEditor {
  readonly asset = input.required<AssetTarget>();

  constructor() {
    inject(AssetEditorStore).showAsset(this.asset);
  }
}
