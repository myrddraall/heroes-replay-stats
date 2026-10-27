import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import type { MapAssets } from '../pack/map-assets';
import type { PackTeamColours, TilePackLayer } from '../pack/map-pack';
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
import { isAsShot, recolouredPicture, teamColoursKey, type TeamColours } from './team-colour';
import type { Tile, TilePyramid } from './tile-pyramid';

/** Recolouring a layer's tiles: its mask's pyramid, the colours as shot and as wanted, and their key. */
interface Recolour {
  readonly mask: TilePyramid;
  readonly shot: PackTeamColours;
  readonly wanted: TeamColours;
  readonly key: string;
}

/** A tile's fade-in once loaded, in milliseconds. */
const FADE_MS = 250;

/**
 * A tiled layer of the pack, drawn on the canvas it is placed on: `"map"` for the terrain (the
 * shown arena's map layer), or a sky layer's id (`"background"`, `"haze"`), at the parallax rate
 * of its placement. Every visible tile at the level whose pixels are about one screen pixel (never
 * coarser than the overview's), drawn from the finest coarser level loaded so far until its own
 * arrives, which then fades in. The layer's overview (PACK.md, Overviews) comes first, cut into its
 * level's tiles, so the whole layer is on screen after one request; the finer levels' tiles from
 * the map's assets. In other team colours (PACK.md, Team colour), each tile with team colour is
 * recoloured from the same tile of the layer's team-colour mask, kept until the colours change; a
 * tile whose mask's tile is still on its way waits for it like a tile not yet loaded (drawn from
 * the coarser levels, already recoloured), so it never shows in the colours as shot.
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
  /** The colours the teams are shown in; null: as the pack has them. */
  readonly teamColours = input<TeamColours | null>(null);

  readonly element = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
  private readonly store = inject(MapViewerStore);
  private readonly renderer = inject(MapRenderer);
  private readonly loader = inject(MapTileLoader);
  private readonly place = inject(MapLayerPlacement);
  private pyramids = new Map<string, TilePyramid>();
  /** Each pyramid's team-colour mask's, by the layer's id, where it has one. */
  private masks = new Map<string, TilePyramid>();
  /** The pack's team colours as shot. */
  private shot: PackTeamColours | null = null;

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
        layers.map((l) => [l.id, this.loader.open(l, map.assets.tiles(l.file))]),
      );
      // A mask's pyramid is the layer's geometry with the mask's files.
      const masks = new Map(
        layers.flatMap((l) =>
          l.teamMask
            ? [
                [
                  l.id,
                  this.loader.open({ ...l, ...l.teamMask }, map.assets.tiles(l.teamMask.file)),
                ] as const,
              ]
            : [],
        ),
      );
      this.pyramids = opened;
      this.masks = masks;
      this.shot = map.pack.teamColours;
      const abort = new AbortController();
      for (const pyramid of [...opened.values(), ...masks.values()])
        this.seedFromOverview(pyramid, map.assets, abort.signal);
      onCleanup(() => {
        abort.abort();
        for (const pyramid of [...opened.values(), ...masks.values()]) this.loader.close(pyramid);
      });
    });
    effect(() => {
      this.visible();
      this.teamColours();
      this.renderer.redraw();
    });
    effect((onCleanup) => onCleanup(this.renderer.register(this)));
  }

  placement() {
    return this.place.placement();
  }

  /**
   * The overview's level filled from the overview: its tiles marked as on their way, so the loader
   * doesn't ask the pyramid for them, then cut out of the picture (a tile past its edge is padded
   * with transparency, as the pyramid's are) and faded in like loaded tiles.
   */
  private seedFromOverview(pyramid: TilePyramid, assets: MapAssets, signal: AbortSignal): void {
    const overview = pyramid.layer.overview;
    const size = pyramid.layer.tileSize;
    const [cols, rows] = pyramid.grid(overview.level);
    const tiles: [number, number, Tile][] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = pyramid.tileAt(overview.level, x, y, 0);
        if (tile.state !== 'new') continue;
        tile.state = 'queued';
        tiles.push([x, y, tile]);
      }
    }
    assets
      .picture(overview.file, signal, 'high')
      .then(async (picture) => {
        for (const [x, y, tile] of tiles) {
          if (signal.aborted) break;
          tile.bitmap = await createImageBitmap(picture, x * size, y * size, size, size);
          tile.state = 'loaded';
          tile.at = performance.now();
        }
        picture.close();
        this.renderer.redraw();
      })
      .catch(() => {
        for (const [, , tile] of tiles) if (tile.state === 'queued') tile.state = 'new';
      });
  }

  render(frame: LayerFrame): MapLayerStatus {
    const context = frameContext(this.element, frame.viewport);
    const id = this.layerId() === 'map' ? frame.arena.layer.id : this.layerId();
    const pyramid = this.pyramids.get(id);
    if (!this.visible() || !pyramid) return LAYER_DONE;
    const wanted = this.teamColours();
    const mask = this.masks.get(id);
    const recolour =
      mask && this.shot && wanted && !isAsShot(wanted, this.shot)
        ? { mask, shot: this.shot, wanted, key: teamColoursKey(wanted) }
        : null;
    const status = this.draw(context, pyramid, frame, recolour);
    this.loader.endFrame(frame.number);
    return status;
  }

  /**
   * A loaded tile's picture, and since when it has been ready (for its fade-in): itself, or in other
   * team colours once its mask's tile has arrived (asked for here; an empty mask tile, or one at a
   * level the mask doesn't store: no team colour there). Null while the mask's tile is on its way,
   * so the tile is drawn from a coarser level meanwhile; at the overview's level, which has none,
   * itself until then.
   */
  private picture(
    tile: Tile,
    at: { level: number; x: number; y: number; frame: number; priority: number },
    recolour: Recolour | null,
  ): { source: CanvasImageSource; at: number } | null {
    if (!tile.bitmap) return null;
    if (!recolour) return { source: tile.bitmap, at: tile.at };
    const { level, x, y, frame, priority } = at;
    const mask = recolour.mask;
    const maskTile = mask.tileAt(level, x, y, frame);
    const hasMask = mask.stored(level) || level === mask.floor;
    if (mask.stored(level)) this.loader.request(mask, level, x, y, maskTile, priority);
    if (!hasMask || maskTile.state === 'empty') return { source: tile.bitmap, at: tile.at };
    if (maskTile.state !== 'loaded' || !maskTile.bitmap) {
      return level === mask.floor ? { source: tile.bitmap, at: tile.at } : null;
    }
    if (tile.recoloured?.key !== recolour.key) {
      const size = mask.layer.tileSize;
      const picture = {
        source: tile.bitmap,
        x: 0,
        y: 0,
        w: size,
        h: size,
        mask: maskTile.bitmap,
        maskX: 0,
        maskY: 0,
      };
      tile.recoloured = {
        key: recolour.key,
        canvas: recolouredPicture(picture, recolour.shot, recolour.wanted),
      };
    }
    return { source: tile.recoloured.canvas, at: Math.max(tile.at, maskTile.at) };
  }

  private draw(
    context: CanvasRenderingContext2D,
    pyramid: TilePyramid,
    frame: LayerFrame,
    recolour: Recolour | null,
  ): MapLayerStatus {
    const { viewport, camera, projection } = frame;
    const meta = pyramid.layer;
    const scale = projection.scale;
    const middle = middlePixel(meta, camera, frame.arena.skyAnchor, projection.rate);
    const level = Math.max(pyramid.floor, tileLevel(meta.levels, scale, viewport.dpr));
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
        if (pyramid.stored(level)) this.loader.request(pyramid, level, x, y, tile, priority);
        if (tile.state === 'empty') continue;
        const picture =
          tile.state === 'loaded'
            ? this.picture(tile, { level, x, y, frame: frame.number, priority }, recolour)
            : null;
        if (!picture) {
          complete = false;
          this.drawFromAbove(context, pyramid, level, x, y, box, priority, frame.number, recolour);
          continue;
        }
        const age = frame.now - picture.at;
        if (age < FADE_MS) {
          this.drawFromAbove(context, pyramid, level, x, y, box, priority, frame.number, recolour);
          context.globalAlpha = Math.max(0, age / FADE_MS);
          animating = true;
        }
        context.drawImage(picture.source, box.x, box.y, box.w, box.h);
        context.globalAlpha = 1;
      }
    }
    return { complete, animating };
  }

  /**
   * A tile's area from the finest coarser level loaded, down to the overview's; asks for the
   * stored levels it falls back on.
   */
  private drawFromAbove(
    context: CanvasRenderingContext2D,
    pyramid: TilePyramid,
    level: number,
    x: number,
    y: number,
    box: ScreenBox,
    priority: number,
    frame: number,
    recolour: Recolour | null,
  ): void {
    const size = pyramid.layer.tileSize;
    for (let above = level - 1; above >= pyramid.floor; above--) {
      const f = 2 ** (level - above);
      const ax = Math.floor(x / f);
      const ay = Math.floor(y / f);
      const tile = pyramid.tileAt(above, ax, ay, frame);
      if (tile.state === 'empty') return;
      const picture =
        tile.state === 'loaded'
          ? this.picture(tile, { level: above, x: ax, y: ay, frame, priority }, recolour)
          : null;
      if (picture) {
        const part = size / f;
        context.drawImage(
          picture.source,
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
      if (above === level - 2 && pyramid.stored(above)) {
        this.loader.request(pyramid, above, ax, ay, tile, priority - 1e6 * (level - above));
      }
    }
  }
}
