import { Component, computed, inject, input } from '@angular/core';
import { MapsStore } from '@myrddraall/heroes-replay-stats-map';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellNavChildren } from '../../shell/shell-nav';
import { ShellNavLinks } from '../../shell/shell-nav-links';
import { MapExplore } from './explore/map-explore';

/**
 * One map, by its id in the address (`/maps/battlefield-of-eternity`), in explore mode; listed in
 * the main nav under Maps while it is open.
 */
@Component({
  selector: 'hrs-map-page',
  imports: [MapExplore, Layout, LayoutItem, ShellNavChildren, ShellNavLinks],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  /** From the route. */
  readonly mapId = input.required<string>();

  private readonly catalog = inject(MapsStore);
  /** The open map, for the main nav; none until the catalog has loaded. */
  protected readonly navLinks = computed(() => {
    const map = this.catalog.maps().find((m) => m.id === this.mapId());
    return map ? [{ path: `/maps/${map.id}`, title: map.name }] : [];
  });
}
