import { computed, Directive, effect, inject, input } from '@angular/core';
import { resolvePlacement } from '../view/layer-stack';
import { MapRenderer } from './map-renderer';
import { MapViewerStore } from './map-viewer.store';

/**
 * A layer's place in the viewer's stack and its parallax, as data: `order` (back to front) and
 * `rate` (1 moves with the map, 0 not at all). Each is a number, or one of the pack's layers by
 * id: `order="map"` sits just in front of the terrain, `rate="haze"` moves with the haze. Every
 * layer composes it as a host directive, custom layers too.
 */
@Directive({ selector: '[hrsMapLayerPlacement]' })
export class MapLayerPlacement {
  readonly order = input<number | string>();
  readonly rate = input<number | string>();

  private readonly store = inject(MapViewerStore);
  readonly placement = computed(() =>
    resolvePlacement(this.order(), this.rate(), this.store.stack()),
  );

  constructor() {
    const renderer = inject(MapRenderer);
    effect(() => {
      this.placement();
      renderer.redraw();
    });
  }
}
