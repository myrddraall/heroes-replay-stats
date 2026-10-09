import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import type { TilePackLayer } from '../pack/map-pack';
import { middlePixel, screenBox, tileLevel, type ScreenBox } from '../view/camera';
import { frameContext, LAYER_STYLE } from '../viewer/canvas';
import {
  LAYER_DONE,
  type LayerFrame,
  type MapLayer,
  type MapLayerStatus,
} from '../viewer/map-layer';
import { MapLayerPlacement } from '../viewer/map-layer-placement';
import { MapRenderer } from '../viewer/map-renderer';
import { MapViewerStore } from '../viewer/map-viewer.store';
import { MapTileLoader } from './map-tile-loader';
import type { TilePyramid } from './tile-pyramid';

/** A tile's fade-in once loaded, in milliseconds. */
const FADE_MS = 250;

/**
 * A tiled layer of the pack, drawn on the canvas it is placed on: `"map"` for the terrain (the
 * shown arena's map layer), or a sky layer's id (`"background"`, `"haze"`), at the parallax rate
 * of its placement. Every visible tile at the level whose pixels are about one screen pixel,
 * drawn from the finest coarser level loaded so far until its own arrives, which then fades in.
 * The tiles come from the map's assets.
 */
@Directive({
  selector: 'canvas[hrsMapTileLayer]',
  hostDirectives: [{ directive: MapLayerPlacement, inputs: ['order', 'rate'] }],
  host: { style: LAYER_STYLE, 'aria-hidden': 'true', '[hidden]': '!visible()' },
})
export class MapTileLayer implements MapLayer {
  /** `"map"`, or the id of one of the pack's parallax layers. */
  readonly layerId = input.required<string>({ alias: 'hrsMapTileLayer' });
  readonly visible = input(true);

  readonly element = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
  private readonly store = inject(MapViewerStore);
  private readonly renderer = inject(MapRenderer);
  private readonly loader = inject(MapTileLoader);
  private readonly place = inject(MapLayerPlacement);
  private pyramids = new Map<string, TilePyramid>();

  constructor() {
    // The pack's pyramids that this layer draws, opened again for each pack.
    effect((onCleanup) => {
      const map = this.store.map();
      if (!map) return;
      const id = this.layerId();
      const layers = map.pack.layers.filter(
        (l): l is TilePackLayer =>
          l.kind !== 'fixed' && (id === 'map' ? l.kind === 'map' : l.id === id),
      );
      const opened = new Map(
        layers.map((l) => [l.id, this.loader.open(l, map.assets.tiles(l.id))]),
      );
      this.pyramids = opened;
      onCleanup(() => {
        for (const pyramid of opened.values()) this.loader.close(pyramid);
      });
    });
    effect(() => {
      this.visible();
      this.renderer.redraw();
    });
    effect((onCleanup) => onCleanup(this.renderer.register(this)));
  }

  placement() {
    return this.place.placement();
  }

  render(frame: LayerFrame): MapLayerStatus {
    const context = frameContext(this.element, frame.viewport);
    const pyramid = this.pyramids.get(
      this.layerId() === 'map' ? frame.arena.layer.id : this.layerId(),
    );
    if (!this.visible() || !pyramid) return LAYER_DONE;
    const status = this.draw(context, pyramid, frame);
    this.loader.endFrame(frame.number);
    return status;
  }

  private draw(
    context: CanvasRenderingContext2D,
    pyramid: TilePyramid,
    frame: LayerFrame,
  ): MapLayerStatus {
    const { viewport, camera, projection } = frame;
    const meta = pyramid.layer;
    const scale = projection.scale;
    const middle = middlePixel(meta, camera, frame.arena.skyAnchor, projection.rate);
    const level = tileLevel(meta.levels, scale, viewport.dpr);
    const span = pyramid.span(level);
    const [cols, rows] = pyramid.grid(level);
    const [u, v] = middle;
    const x0 = Math.max(0, Math.floor((u - viewport.width / 2 / scale) / span));
    const x1 = Math.min(cols - 1, Math.floor((u + viewport.width / 2 / scale) / span));
    const y0 = Math.max(0, Math.floor((v - viewport.height / 2 / scale) / span));
    const y1 = Math.min(rows - 1, Math.floor((v + viewport.height / 2 / scale) / span));
    let complete = true;
    let animating = false;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const box = screenBox(viewport, middle, scale, x * span, y * span, span, span);
        const priority =
          level * 1e6 +
          Math.hypot(
            box.x + box.w / 2 - viewport.width / 2,
            box.y + box.h / 2 - viewport.height / 2,
          );
        const tile = pyramid.tileAt(level, x, y, frame.number);
        this.loader.request(pyramid, level, x, y, tile, priority);
        if (tile.state === 'empty') continue;
        if (tile.state !== 'loaded' || !tile.bitmap) {
          complete = false;
          this.drawFromAbove(context, pyramid, level, x, y, box, priority, frame.number);
          continue;
        }
        const age = frame.now - tile.at;
        if (age < FADE_MS) {
          this.drawFromAbove(context, pyramid, level, x, y, box, priority, frame.number);
          context.globalAlpha = Math.max(0, age / FADE_MS);
          animating = true;
        }
        context.drawImage(tile.bitmap, box.x, box.y, box.w, box.h);
        context.globalAlpha = 1;
      }
    }
    return { complete, animating };
  }

  /** A tile's area from the finest coarser level loaded; asks for the levels it falls back on. */
  private drawFromAbove(
    context: CanvasRenderingContext2D,
    pyramid: TilePyramid,
    level: number,
    x: number,
    y: number,
    box: ScreenBox,
    priority: number,
    frame: number,
  ): void {
    const size = pyramid.layer.tileSize;
    for (let above = level - 1; above >= 0; above--) {
      const f = 2 ** (level - above);
      const ax = Math.floor(x / f);
      const ay = Math.floor(y / f);
      const tile = pyramid.tileAt(above, ax, ay, frame);
      if (tile.state === 'empty') return;
      if (tile.state === 'loaded' && tile.bitmap) {
        const part = size / f;
        context.drawImage(
          tile.bitmap,
          (x - ax * f) * part,
          (y - ay * f) * part,
          part,
          part,
          box.x,
          box.y,
          box.w,
          box.h,
        );
        return;
      }
      if (above === 0 || above === level - 2) {
        this.loader.request(pyramid, above, ax, ay, tile, priority - 1e6 * (level - above));
      }
    }
  }
}
