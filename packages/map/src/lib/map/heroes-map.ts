import { Component, inject, input } from '@angular/core';
import { MapViewer } from '../viewer/map-viewer';
import { MapStore } from './map.store';

/**
 * A map, by id (container): its `MapStore` loads it from heroes-maps and keeps what is shown of
 * it, and hands that to the viewer; a click on a structure or camp steps it to its next state.
 */
@Component({
  selector: 'hrs-map',
  imports: [MapViewer],
  templateUrl: './heroes-map.html',
  styleUrl: './heroes-map.scss',
  providers: [MapStore],
})
export class HeroesMap {
  /** The map's id in heroes-maps (`battlefield-of-eternity`). */
  readonly mapId = input.required<string>();

  protected readonly store = inject(MapStore);

  constructor() {
    this.store.load(this.mapId);
  }
}
