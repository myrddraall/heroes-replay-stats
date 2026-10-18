import { Component, inject } from '@angular/core';
import { BACKGROUND_SCENE } from '../../../scenes/play-background/background-design.tokens';
import { Editor } from './editor';
import { EditorLayout } from './editor-layout';
import { LibraryEditorStore } from './library-editor.store';

/**
 * The library editor (container): provides its store as the `Editor` the panels under it use and,
 * as the scene the background under it shows, the preview stage: the asset opened, on the stage's
 * own sky.
 */
@Component({
  selector: 'hrs-library-editor',
  imports: [EditorLayout],
  providers: [
    LibraryEditorStore,
    { provide: Editor, useExisting: LibraryEditorStore },
    {
      provide: BACKGROUND_SCENE,
      useFactory: () => {
        const store = inject(LibraryEditorStore);
        return { planets: store.stagePlanets, sky: store.stageSky, tint: store.stageTint };
      },
    },
  ],
  templateUrl: './library-editor.html',
})
export class LibraryEditor {}
