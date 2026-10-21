import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { LightId } from '../../../scenes/play-background/scene-lights';
import { PropertySection } from '../properties/property-section';
import type { LitByEntry } from './editor-model';

let next = 0;

/**
 * What lights what is selected (presentational): each light that acts on it (a body's, its
 * overlay's, the library's, the scene's, a planet's it is a moon of), and whether it lights it: a body's, whether it is on for it; a part's or material's, whether it
 * reaches it. Checked or not, it is taken in or left out there; each can be gone to in the tree,
 * and one added at the level edited taken out.
 */
@Component({
  selector: 'hrs-lit-by',
  imports: [MatIcon, PropertySection],
  templateUrl: './lit-by.html',
  styleUrls: ['./properties-panel.scss', './lit-by.scss'],
})
export class LitBy {
  readonly lights = input.required<readonly LitByEntry[]>();
  readonly litChange = output<{ readonly id: LightId; readonly on: boolean }>();
  /** A light's button pressed: it selected in the tree. */
  readonly lightShow = output<LightId>();
  /** A light added here taken out. */
  readonly lightRemove = output<LightId>();
  protected readonly id = `lit-by-${next++}`;

  protected check(id: LightId, event: Event): void {
    this.litChange.emit({ id, on: (event.target as HTMLInputElement).checked });
  }
}
