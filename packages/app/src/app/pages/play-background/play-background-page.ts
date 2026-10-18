import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BACKGROUND_DESIGN } from '../../scenes/play-background/background-design.tokens';
import { DraftDesignStore } from './draft-design.store';
import { EditorUiStore } from './editor/editor-ui.store';
import { LibraryEditor } from './editor/library-editor';
import { SceneEditor } from './editor/scene-editor';

/**
 * The Play screen background on its own, filling the window, as an editor of its design
 * (container). It provides a draft of the design ({@link DraftDesignStore}) as the design in
 * effect for everything under it, so what it shows and edits is the draft while the rest of the
 * site shows what is published, until Save; and its own UI state. It edits a scene (its planet
 * the URL's `?planet=`; none: the random sets) or the library, each editor providing its own store
 * to the tree, properties and background under it.
 */
@Component({
  selector: 'hrs-play-background-page',
  imports: [SceneEditor, LibraryEditor],
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
  ],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  /** The scene's planet, by id, from the URL's `?planet=`; none: the random sets. */
  readonly planet = input<string>();

  protected readonly ui = inject(EditorUiStore);
  private readonly router = inject(Router);

  /** A planet chosen: put in the URL, which shows it ('' takes it out: the random sets). */
  protected choosePlanet(id: string): void {
    void this.router.navigate([], {
      queryParams: { planet: id || null },
      queryParamsHandling: 'merge',
    });
  }
}
