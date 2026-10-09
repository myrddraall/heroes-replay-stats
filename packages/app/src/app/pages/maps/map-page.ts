import { Component, input } from '@angular/core';
import { HeroesMap } from '@myrddraall/heroes-replay-stats-map';

/** One map, by its id in the address (`/maps/battlefield-of-eternity`). */
@Component({
  selector: 'hrs-map-page',
  imports: [HeroesMap],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  /** From the route. */
  readonly mapId = input.required<string>();
}
