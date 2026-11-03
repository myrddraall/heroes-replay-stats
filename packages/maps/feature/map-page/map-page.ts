import { Component, inject, input } from '@angular/core';
import { MapsStore } from '../../data';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { showShellItem } from '@myrddraall/heroes-replay-stats-shell/feature';
import { MapExplore } from '..';

/**
 * One map, by its id in the address (`/game/maps/battlefield-of-eternity`), in explore mode; in
 * the shell's navigation under Game › Maps while it is open.
 */
@Component({
  selector: 'hrs-map-page',
  imports: [MapExplore, Layout, LayoutItem],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  /** From the route. */
  readonly mapId = input.required<string>();

  private readonly catalog = inject(MapsStore);

  constructor() {
    // the open map, once the catalog has loaded
    showShellItem(() => {
      const map = this.catalog.maps().find((m) => m.id === this.mapId());
      return map ? { under: '/game/maps', label: map.name, link: `/game/maps/${map.id}` } : null;
    });
  }
}
