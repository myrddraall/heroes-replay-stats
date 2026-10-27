import { Component, computed, inject, input } from '@angular/core';
import { SCENE_SOURCE } from '@myrddraall/heroes-replay-stats-aether/view';
import { AssetEditorStore } from './asset-editor.store';
import { AssetHeader } from './asset-header';
import { Editor } from '../editing/editor';
import { OVERRIDE_SHOWN } from '../controls/rows/override-shown';
import { EditorLayout } from '../layout/editor-layout';
import { EditorUiStore } from '../layout/editor-ui.store';
import { selectParentWhenGone } from '../tree/select-parent-when-gone';
import type { AssetTarget } from '../layout/open-target';

/**
 * The asset editor (container): provides its store as the `Editor` the panels under it use and,
 * as the scene the background under it shows, the preview stage: the asset `asset` says (the
 * URL's), on the stage's own sky.
 */
@Component({
  selector: 'forge-asset-editor',
  imports: [EditorLayout, AssetHeader],
  providers: [
    AssetEditorStore,
    { provide: Editor, useExisting: AssetEditorStore },
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
          // The light selected's beams, with the markers (none in a screenshot or the library's preview).
          beams: computed(() =>
            ui.markers() !== 'none' && !ui.screenshot() && !ui.browsing() ? store.beams() : [],
          ),
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
