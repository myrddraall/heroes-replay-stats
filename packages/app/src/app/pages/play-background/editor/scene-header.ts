import { Component, inject } from '@angular/core';
import { SceneEditorStore } from './scene-editor.store';

/** The scene editor's head (container, on its store): the moon the view is centred on, if any. */
@Component({
  selector: 'hrs-scene-header',
  templateUrl: './scene-header.html',
  styleUrl: './scene-header.scss',
})
export class SceneHeader {
  protected readonly store = inject(SceneEditorStore);
}
