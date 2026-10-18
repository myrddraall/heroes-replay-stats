import { Component, inject } from '@angular/core';
import { PropertySelect } from '../properties/property-select';
import { SceneEditorStore } from './scene-editor.store';

/**
 * The scene editor's head (container, on its store): the planet the scene is of (the random
 * sets' has none), and the moon the view is centred on.
 */
@Component({
  selector: 'hrs-scene-header',
  imports: [PropertySelect],
  templateUrl: './scene-header.html',
  styleUrl: './scene-header.scss',
})
export class SceneHeader {
  protected readonly store = inject(SceneEditorStore);
}
