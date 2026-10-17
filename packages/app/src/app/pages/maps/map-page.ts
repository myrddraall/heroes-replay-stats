import { Component, input } from '@angular/core';
import { Layout } from '../../layout/layout';
import { LayoutItem } from '../../layout/layout-item';
import { MapExplore } from './explore/map-explore';

/** One map, by its id in the address (`/maps/battlefield-of-eternity`), in explore mode. */
@Component({
  selector: 'hrs-map-page',
  imports: [MapExplore, Layout, LayoutItem],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  /** From the route. */
  readonly mapId = input.required<string>();
}
