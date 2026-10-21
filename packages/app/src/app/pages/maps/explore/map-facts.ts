import { Component, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import type { MapFacts as PackFacts } from '@myrddraall/heroes-replay-stats-map';
import type { MapExtraInfo, MapPicture } from './map-info';

/**
 * The map's facts (presentational): what the pack says of it and its loading-screen art, and
 * what hero-data adds — its objectives.
 */
@Component({
  selector: 'hrs-map-facts',
  imports: [MatProgressBar],
  templateUrl: './map-facts.html',
  styleUrl: './map-facts.scss',
})
export class MapFacts {
  readonly facts = input<PackFacts | null>(null);
  readonly loadingScreen = input<MapPicture | null>(null);
  readonly extra = input<MapExtraInfo | null>(null);
  /** Hero-data is still loading. */
  readonly extraLoading = input(false);

  /** The objectives' icons' height in CSS pixels; their width follows. */
  protected readonly iconHeight = 40;

  /** How wide an icon is drawn, for its `sizes` (the browser picks its version by it). */
  protected iconSizes(icon: MapPicture): string {
    return `${Math.ceil((this.iconHeight * icon.width) / icon.height)}px`;
  }

  protected boundsLabel(b: { left: number; bottom: number; right: number; top: number }): string {
    return `${Math.round(b.right - b.left)} × ${Math.round(b.top - b.bottom)} cells, from (${Math.round(b.left)}, ${Math.round(b.bottom)})`;
  }
}
