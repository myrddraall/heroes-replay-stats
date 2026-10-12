import { Component, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import type { MapFacts as PackFacts } from '@myrddraall/heroes-replay-stats-map';
import type { MapExtraInfo } from './map-info';

/**
 * The map's facts (presentational): what the pack says of it, and what hero-data adds — its
 * objectives, and its loading-screen art.
 */
@Component({
  selector: 'hrs-map-facts',
  imports: [MatProgressBar],
  templateUrl: './map-facts.html',
  styleUrl: './map-facts.scss',
})
export class MapFacts {
  readonly facts = input<PackFacts | null>(null);
  readonly extra = input<MapExtraInfo | null>(null);
  /** Hero-data is still loading. */
  readonly extraLoading = input(false);

  protected boundsLabel(b: { left: number; bottom: number; right: number; top: number }): string {
    return `${Math.round(b.right - b.left)} × ${Math.round(b.top - b.bottom)} cells, from (${Math.round(b.left)}, ${Math.round(b.bottom)})`;
  }
}
