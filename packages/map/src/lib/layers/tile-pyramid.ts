import type { TileArchive } from '../pack/map-assets';
import type { TilePackLayer } from '../pack/map-pack';

export type TileState = 'new' | 'queued' | 'loaded' | 'empty';

/** One tile of a pyramid, as far as it has been loaded. */
export interface Tile {
  state: TileState;
  bitmap: ImageBitmap | null;
  /** When it finished loading (`performance.now()`), for its fade-in. */
  at: number;
  /** The last frame that needed it. */
  used: number;
}

/** A layer's tile pyramid (PACK.md, Tile pyramids) and the tiles loaded from it so far. */
export class TilePyramid {
  readonly tiles = new Map<string, Tile>();

  constructor(
    readonly layer: TilePackLayer,
    readonly archive: TileArchive,
  ) {}

  /** A tile, marked as needed in this frame. */
  tileAt(level: number, x: number, y: number, frame: number): Tile {
    const key = `${level}/${x}/${y}`;
    let tile = this.tiles.get(key);
    if (!tile) {
      tile = { state: 'new', bitmap: null, at: 0, used: 0 };
      this.tiles.set(key, tile);
    }
    tile.used = frame;
    return tile;
  }

  /** A tile's span in full-size layer pixels at a level. */
  span(level: number): number {
    return this.layer.tileSize * 2 ** (this.layer.levels - 1 - level);
  }

  /** The columns and rows of tiles at a level. */
  grid(level: number): [number, number] {
    const span = this.span(level);
    return [Math.ceil(this.layer.size[0] / span), Math.ceil(this.layer.size[1] / span)];
  }
}

/** A tile to load, and how soon (smaller first). */
export interface TileJob {
  readonly pyramid: TilePyramid;
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly tile: Tile;
  readonly priority: number;
}

/**
 * Of all the loaded tiles, the ones to drop to keep `keep`: the least recently needed first,
 * never one needed in this frame.
 */
export function tilesToEvict(
  pyramids: Iterable<TilePyramid>,
  keep: number,
  frame: number,
): [TilePyramid, string, Tile][] {
  const loaded: [TilePyramid, string, Tile][] = [];
  for (const pyramid of pyramids) {
    for (const [key, tile] of pyramid.tiles) {
      if (tile.state === 'loaded') loaded.push([pyramid, key, tile]);
    }
  }
  if (loaded.length <= keep) return [];
  loaded.sort((a, b) => a[2].used - b[2].used);
  return loaded.slice(0, loaded.length - keep).filter(([, , tile]) => tile.used < frame);
}
