import { Component, computed, input, output } from '@angular/core';
import { MAX_LIGHTS, MAX_SHADES } from '@myrddraall/heroes-replay-stats-aether/render';
import { MatIcon } from '@angular/material/icon';
import type { LightId } from '@myrddraall/heroes-replay-stats-aether/lights';
import { PropertySection } from '../controls/property-section';
import type { LitByEntry } from './lights';
let next = 0;

/**
 * What lights what is selected (presentational): each light that acts on it (a body's, its
 * overlay's, the library's, the scene's, another body's: named by what it is of), and whether it lights it: a body's, whether it is on for it; a part's or material's, whether it
 * reaches it. Checked or not, it is taken in or left out there; each can be gone to in the tree,
 * and one added at the level edited taken out.
 */
@Component({
  selector: 'forge-lit-by',
  imports: [MatIcon, PropertySection],
  templateUrl: './lit-by.html',
  styleUrls: ['../panel/properties-panel.scss', './lit-by.scss'],
})
export class LitBy {
  readonly lights = input.required<readonly LitByEntry[]>();
  readonly litChange = output<{ readonly id: LightId; readonly on: boolean }>();
  /** A light's button pressed: it selected in the tree. */
  readonly lightShow = output<LightId>();
  /** A light added here taken out. */
  readonly lightRemove = output<LightId>();
  protected readonly id = `lit-by-${next++}`;
  /**
   * What a body is drawn with past its limits, as a line under its lights (none: within them):
   * those that light (all but ambient ones, which add up into one) and those that darken.
   */
  protected readonly over = computed(() => {
    const acting = this.lights().filter((l) => l.reaches);
    const lighting = acting.filter((l) => !l.darkens && l.kind !== 'ambient').length;
    const darkening = acting.filter((l) => l.darkens).length;
    const lines = [
      ...(lighting > MAX_LIGHTS
        ? [`Only ${MAX_LIGHTS} of its ${lighting} lights that light are drawn.`]
        : []),
      ...(darkening > MAX_SHADES
        ? [`Only ${MAX_SHADES} of its ${darkening} lights that darken are drawn.`]
        : []),
    ];
    return lines.join(' ') || null;
  });

  protected check(id: LightId, event: Event): void {
    this.litChange.emit({ id, on: (event.target as HTMLInputElement).checked });
  }
}
