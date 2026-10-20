import { Component, input, output } from '@angular/core';
import type { LightId } from '../../../scenes/play-background/scene-lights';
import { PropertyCheck } from '../properties/property-check';
import { PropertySection } from '../properties/property-section';
import type { LitByEntry } from './editor-model';

/**
 * What lights what is selected (presentational): each light that acts on it (a body's, its
 * overlay's, the library's, the scene's, a planet's it is a moon of), where it comes from, and
 * whether it lights it: a body's, whether it is on for it; a part's or material's, whether it
 * reaches it. Checked or not, it is taken in or left out there.
 */
@Component({
  selector: 'hrs-lit-by',
  imports: [PropertySection, PropertyCheck],
  templateUrl: './lit-by.html',
  styleUrl: './properties-panel.scss',
})
export class LitBy {
  readonly lights = input.required<readonly LitByEntry[]>();
  readonly litChange = output<{ readonly id: LightId; readonly on: boolean }>();
}
