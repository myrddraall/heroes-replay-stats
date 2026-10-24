import { Component, computed, inject, input } from '@angular/core';
import { BACKGROUND_SCENE } from '../../../scenes/play-background/background-design.tokens';
import { AssetEditorStore } from './asset-editor.store';
import { AssetHeader } from './asset-header';
import { Editor } from './editor';
import { EditorLayout } from './editor-layout';
import { EditorUiStore } from './editor-ui.store';
import { selectParentWhenGone } from './select-parent-when-gone';
import type { AssetTarget } from './open-target';

/**
 * The asset editor (container): provides its store as the `Editor` the panels under it use and,
 * as the scene the background under it shows, the preview stage: the asset `asset` says (the
 * URL's), on the stage's own sky.
 */
@Component({
  selector: 'hrs-asset-editor',
  imports: [EditorLayout, AssetHeader],
  providers: [
    AssetEditorStore,
    { provide: Editor, useExisting: AssetEditorStore },
    {
      provide: BACKGROUND_SCENE,
      useFactory: () => {
        const store = inject(AssetEditorStore);
        const ui = inject(EditorUiStore);
        return {
          planets: store.stagePlanets,
          sky: store.stageSky,
          tint: store.stageTint,
          backdrop: store.stageBackdrop,
          key: store.stageKey,
          camera: store.viewCamera,
          // An anchored sky moves with the view's camera, or (not following it) with the game's.
          skyFollow: computed(() => (ui.skyFollows() ? null : {})),
          // The light selected's beams, with the markers (none in a screenshot).
          beams: computed(() => (ui.markers() !== 'none' && !ui.screenshot() ? store.beams() : [])),
        };
      },
    },
  ],
  templateUrl: './asset-editor.html',
})
export class AssetEditor {
  readonly asset = input.required<AssetTarget>();

  constructor() {
    selectParentWhenGone(inject(Editor));
    inject(AssetEditorStore).showAsset(this.asset);
  }
}
