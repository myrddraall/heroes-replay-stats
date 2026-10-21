import { Component, computed, inject, input } from '@angular/core';
import { BACKGROUND_DESIGN } from '../../scenes/play-background/background-design.tokens';
import { BUILT_IN_PLANETS } from '../../scenes/play-background/built-in-planets';
import { DraftDesignStore } from './draft-design.store';
import { AssetCatalogStore } from './editor/asset-catalog.store';
import { AssetEditor } from './editor/asset-editor';
import { EditingAidsStore } from './editor/editing-aids.store';
import { EditorUiStore } from './editor/editor-ui.store';
import { isAsset, libraryKindOf, libraryShown, openOf, RANDOM_SETS } from './editor/open-target';
import { SceneEditor } from './editor/scene-editor';
import { buildStandIn, parseStandIn } from './editor/stand-in';

/**
 * The Play screen background on its own, filling the window, as an editor of its design
 * (container). It provides a draft of the design ({@link DraftDesignStore}) as the design in
 * effect for everything under it, so what it shows and edits is the draft while the rest of the
 * site shows what is published, until Save; its own UI state; the library's lists; and the
 * editing aids (the stage's backdrop, the stand-in planet), never part of the design. Its URL
 * says whether its library shows (`/edit-background/library/<list>/<id>`: a kind listed, one of
 * them shown behind; `/edit-background`: the kind listed last, the random sets behind) or its
 * editor (`/edit-background/<kind>/<id>`: a scene, else one of the library's assets, a material
 * perhaps under the planet or overlay it was opened from), and what is shown: each editor
 * providing its own store to the tree, properties and background under it (the library's lists
 * too, what they show behind them by the editor of its kind).
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
  host: { '(document:keydown)': 'keydown($event)' },
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  /** What is open, from the URL's path; none: the random sets' scene. */
  readonly kind = input<string>();
  readonly id = input<string>();
  /** A material's: the planet or overlay it was opened from. */
  readonly onKind = input<string>();
  readonly onId = input<string>();
  /** The library's: the kind it lists (its list's name in the URL), and what it shows behind. */
  readonly library = input<string>();
  readonly item = input<string>();

  /** Whether the library shows (else the editor, on what the URL opens). */
  private readonly browsing = computed(() => this.kind() === undefined);
  /** The kind the library's URL lists (none: the kind it listed last). */
  private readonly libraryKind = computed(() => libraryKindOf(this.library()));
  /** What is shown: the library's (behind its list), or what is open in the editor. */
  protected readonly opened = computed(() => {
    if (!this.browsing()) return openOf(this.kind(), this.id(), this.onKind(), this.onId());
    const kind = this.libraryKind();
    return kind ? libraryShown(kind, this.item()) : RANDOM_SETS;
  });
  protected readonly isAsset = isAsset;

  private readonly draft = inject(DraftDesignStore);

  constructor() {
    inject(EditorUiStore).followBrowsing(this.browsing);
    inject(AssetCatalogStore).followKind(this.libraryKind);
  }

  /**
   * Ctrl (⌘) + Z undoes the draft's last change, with Shift (or Ctrl + Y) redoes it; a text being
   * typed keeps its own.
   */
  protected keydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable="true"]')
    )
      return;
    const key = event.key.toLowerCase();
    const redo = (key === 'z' && event.shiftKey) || key === 'y';
    if (key !== 'z' && !redo) return;
    event.preventDefault();
    if (redo) this.draft.redo();
    else this.draft.undo();
  }
}
