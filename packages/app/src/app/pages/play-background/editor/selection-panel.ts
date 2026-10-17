import { Component, inject } from '@angular/core';
import { PlayBackgroundPageStore } from '../play-background-page.store';
import { BodyProperties } from './body-properties';
import { MaterialProperties } from './material-properties';
import { SceneProperties } from './scene-properties';
import { TintSection } from './tint-section';

/**
 * The properties of what is selected in the scene (container, on the page's store): the scene's
 * own, the sky's (a tint over all of it), a body's (the planet or a moon) or a material's, each as its presentational
 * properties show them, what they change going back to the store.
 */
@Component({
  selector: 'hrs-selection-panel',
  imports: [TintSection, SceneProperties, BodyProperties, MaterialProperties],
  templateUrl: './selection-panel.html',
  styleUrl: './selection-panel.scss',
})
export class SelectionPanel {
  protected readonly store = inject(PlayBackgroundPageStore);
}
