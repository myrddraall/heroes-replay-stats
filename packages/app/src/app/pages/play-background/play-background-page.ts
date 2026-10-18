import { Component, computed, inject, input } from '@angular/core';
import { BACKGROUND_DESIGN } from '../../scenes/play-background/background-design.tokens';
import { BUILT_IN_PLANETS } from '../../scenes/play-background/built-in-planets';
import { DraftDesignStore } from './draft-design.store';
import { AssetCatalogStore } from './editor/asset-catalog.store';
import { AssetEditor } from './editor/asset-editor';
import { EditingAidsStore } from './editor/editing-aids.store';
import { EditorUiStore } from './editor/editor-ui.store';
import { isAsset, openKey, openOf } from './editor/open-target';
import { SceneEditor } from './editor/scene-editor';
import { buildStandIn, parseStandIn } from './editor/stand-in';

/**
 * The Play screen background on its own, filling the window, as an editor of its design
 * (container). It provides a draft of the design ({@link DraftDesignStore}) as the design in
 * effect for everything under it, so what it shows and edits is the draft while the rest of the
 * site shows what is published, until Save; its own UI state; the library's lists; and the
 * editing aids (the stage's backdrop, the stand-in planet), never part of the design. It edits
 * what the URL's path says (`/edit-background/<kind>/<id>`: a scene, else one of the library's
 * assets; nothing: the random sets' scene, under the library's list), each editor providing its
 * own store to the tree, properties and background under it.
 */
@Component({
  selector: 'hrs-play-background-page',
  imports: [SceneEditor, AssetEditor],
  providers: [
    DraftDesignStore,
    {
      provide: BACKGROUND_DESIGN,
      useFactory: () => {
        const draft = inject(DraftDesignStore);
        return { library: draft.library, scenes: draft.scenes };
      },
    },
    EditorUiStore,
    AssetCatalogStore,
    EditingAidsStore,
    {
      // The editor's stand-in planet, made here, for the backgrounds under the page.
      provide: BUILT_IN_PLANETS,
      useFactory: () => {
        const catalog = inject(AssetCatalogStore);
        return (id: string) => {
          const spec = parseStandIn(id);
          return spec ? buildStandIn(spec, catalog.files()) : undefined;
        };
      },
    },
  ],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  /** What is open, from the URL's path; none: the random sets' scene. */
  readonly kind = input<string>();
  readonly id = input<string>();

  protected readonly opened = computed(() => openOf(this.kind(), this.id()));
  protected readonly isAsset = isAsset;
  private readonly openedKey = computed(() =>
    this.kind() !== undefined ? openKey(this.opened()) : undefined,
  );

  constructor() {
    inject(EditorUiStore).followOpen(this.openedKey);
  }
}
