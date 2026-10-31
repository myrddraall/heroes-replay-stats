import { computed, Directive, effect, ElementRef, inject, input } from '@angular/core';
import { LAYER_STYLE } from '../viewer/canvas';
import { LAYER_DONE, type MapLayer, type MapLayerStatus } from '../viewer/map-layer';
import { MapLayerPlacement } from '../viewer/map-layer-placement';
import { MapRenderer } from '../viewer/map-renderer';
import { MapViewerStore } from '../viewer/map-viewer.store';

/**
 * The pack's fixed skybox, as the background of the element it is placed on: filling the viewer
 * (cover, not stretched), at every zoom. It doesn't move, so it draws nothing in the frames; it
 * registers only to take its place in the stack.
 */
@Directive({
  selector: '[hrsMapFixedLayer]',
  hostDirectives: [{ directive: MapLayerPlacement, inputs: ['order', 'rate'] }],
  host: {
    style: `${LAYER_STYLE} background: center / cover no-repeat;`,
    'aria-hidden': 'true',
    '[hidden]': '!visible() || !url()',
    '[style.background-image]': 'url()',
  },
})
export class MapFixedLayer implements MapLayer {
  readonly visible = input(true);

  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly store = inject(MapViewerStore);
  private readonly place = inject(MapLayerPlacement);
  protected readonly url = computed(() => {
    const map = this.store.map();
    const fixed = map?.pack.layers.find((l) => l.kind === 'fixed');
    return map && fixed ? `url("${map.assets.url(fixed.file)}")` : null;
  });

  constructor() {
    const renderer = inject(MapRenderer);
    effect((onCleanup) => onCleanup(renderer.register(this)));
  }

  placement() {
    return this.place.placement();
  }

  render(): MapLayerStatus {
    return LAYER_DONE;
  }
}
