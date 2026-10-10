import type { MapPack } from './map-pack';

/** Reads a tile pyramid's tiles by level and position: PMTiles' `getZxy`, or a stand-in. */
export interface TileArchive {
  getZxy(z: number, x: number, y: number): Promise<{ data: ArrayBuffer } | undefined>;
}

/**
 * Where a pack's files come from, for the viewer to read as it needs them (which tiles, which
 * pictures, depends on what is in view). The viewer is given one; it never fetches by itself.
 */
export interface MapAssets {
  /** A tiled layer's pyramid, by the layer's id. */
  tiles(layerId: string): TileArchive;
  /**
   * One of the pack's pictures (an atlas, an overview). `priority`: how soon, against the
   * viewer's other requests (`low` unless given: the terrain's tiles come first).
   */
  picture(file: string, abortSignal: AbortSignal, priority?: 'high' | 'low'): Promise<ImageBitmap>;
  /** One of the pack's text files (the custom minimap's SVG). */
  text(file: string, abortSignal: AbortSignal): Promise<string>;
  /** A file's URL, for what the page shows by URL (the fixed skybox). */
  url(file: string): string;
}

/** A map as the viewer is given it: its pack (`pack.json`), and where its files come from. */
export interface MapViewModel {
  readonly pack: MapPack;
  readonly assets: MapAssets;
}
