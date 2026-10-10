import { Component, input } from '@angular/core';
import { HeroesMap } from '@myrddraall/heroes-replay-stats-map';
import { Layout } from '../../layout/layout';
import { LayoutItem } from '../../layout/layout-item';

/** One map, by its id in the address (`/maps/battlefield-of-eternity`). */
@Component({
  selector: 'hrs-map-page',
  imports: [HeroesMap, Layout, LayoutItem],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  /** From the route. */
  readonly mapId = input.required<string>();
}
