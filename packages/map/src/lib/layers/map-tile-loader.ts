import { DestroyRef, inject, Injectable } from '@angular/core';
import type { TileArchive } from '../pack/map-assets';
import type { TilePackLayer } from '../pack/map-pack';
import { MapRenderer } from '../viewer/map-renderer';
import { tilesToEvict, TilePyramid, type Tile, type TileJob } from './tile-pyramid';

/** Tiles fetched at once, over all the layers. */
const MAX_LOADS = 8;
/** Decoded tiles kept, over all the layers (the least recently drawn dropped first). */
const MAX_TILES = 900;

/**
 * Loads the tile layers' tiles, one per viewer (provided by {@link MapViewer}): one queue for
 * them all, nearest the middle and coarsest first, and one limit on the tiles kept.
 */
@Injectable()
export class MapTileLoader {
  private readonly renderer = inject(MapRenderer);
  private readonly pyramids = new Set<TilePyramid>();
  private queue: TileJob[] = [];
  private loading = 0;
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const pyramid of this.pyramids) this.close(pyramid);
    });
  }

  /** A layer's pyramid, read from the archive the map's assets give for it. */
  open(layer: TilePackLayer, archive: TileArchive): TilePyramid {
    const pyramid = new TilePyramid(layer, archive);
    this.pyramids.add(pyramid);
    return pyramid;
  }

  /** Drops a pyramid and its tiles. */
  close(pyramid: TilePyramid): void {
    this.pyramids.delete(pyramid);
    this.queue = this.queue.filter((job) => job.pyramid !== pyramid);
    for (const tile of pyramid.tiles.values()) tile.bitmap?.close();
    pyramid.tiles.clear();
  }

  /** Asks for a tile, if it hasn't been asked for already. */
  request(
    pyramid: TilePyramid,
    level: number,
    x: number,
    y: number,
    tile: Tile,
    priority: number,
  ): void {
    if (tile.state !== 'new') return;
    tile.state = 'queued';
    this.queue.push({ pyramid, level, x, y, tile, priority });
  }

  /** After a layer has drawn its frame: starts what loads can start, and drops old tiles. */
  endFrame(frame: number): void {
    this.pump(frame);
    if (frame === this.frame) return;
    this.frame = frame;
    for (const [pyramid, key, tile] of tilesToEvict(this.pyramids, MAX_TILES, frame)) {
      tile.bitmap?.close();
      pyramid.tiles.delete(key);
    }
  }

  private pump(frame: number): void {
    this.queue.sort((a, b) => a.priority - b.priority);
    while (this.loading < MAX_LOADS && this.queue.length) {
      const job = this.queue.shift();
      if (!job) break;
      if (job.tile.used < frame - 2) {
        // scrolled away before its turn
        job.tile.state = 'new';
        continue;
      }
      this.loading++;
      this.load(job).finally(() => {
        this.loading--;
        this.renderer.redraw();
      });
    }
  }

  private async load({ pyramid, level, x, y, tile }: TileJob): Promise<void> {
    try {
      const found = await pyramid.archive.getZxy(level, x, y);
      if (!this.pyramids.has(pyramid)) return;
      if (found?.data) {
        tile.bitmap = await createImageBitmap(new Blob([found.data], { type: 'image/webp' }));
        tile.state = 'loaded';
      } else {
        tile.state = 'empty'; // not stored: transparent
      }
      tile.at = performance.now();
    } catch {
      tile.state = 'new'; // asked for again the next time it's needed
    }
  }
}
