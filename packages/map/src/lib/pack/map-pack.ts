/**
 * A heroes-capture map pack, format 1: what its `pack.json` holds. heroes-capture's PACK.md is
 * the contract; only what a viewer reads is typed here.
 */
export const MAP_PACK_FORMAT = 1;

/** A rectangle of map cells. */
export interface CellBounds {
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
  readonly top: number;
}

/** A point in map cells: x east, y north. */
export type Cell = readonly [x: number, y: number];

/** A width and height, or an x and y, in pixels. */
export type Pixels = readonly [number, number];

/** The fixed skybox: one screen-sized picture behind everything. */
export interface PackFixedLayer {
  readonly id: string;
  readonly kind: 'fixed';
  readonly file: string;
  readonly size: Pixels;
}

/** What every tiled layer has: a PMTiles pyramid of `levels` levels. */
interface TiledLayer {
  readonly id: string;
  readonly file: string;
  readonly size: Pixels;
  readonly levels: number;
  readonly tileSize: number;
  /** How the layer moves with the camera: 1 for the map, less for the sky behind it. */
  readonly rate: number;
  readonly pxPerCell: number;
}

/** A sky layer (background art, haze): placed from the cell its picture is centred on. */
export interface PackParallaxLayer extends TiledLayer {
  readonly kind: 'parallax';
  readonly centreCell: Cell;
  readonly centrePixel: Pixels;
}

/** The map: placed from the cell at its top-left pixel. One per arena. */
export interface PackMapLayer extends TiledLayer {
  readonly kind: 'map';
  readonly originCell: Cell;
}

export type PackLayer = PackFixedLayer | PackParallaxLayer | PackMapLayer;
export type TilePackLayer = PackParallaxLayer | PackMapLayer;

/** One arena of a map of several (Punisher Arena). */
export interface PackArena {
  readonly id: string;
  readonly label?: string;
  /** The id of the arena's map layer. */
  readonly layer: string;
  readonly boundsCells?: CellBounds;
  readonly middleCell?: Cell;
}

/** A picture of the map, with its size in pixels. */
export interface PackImage {
  readonly file: string;
  readonly size: Pixels;
  readonly source?: string;
}

/** The custom minimap redrawn as SVG, and the map cells it covers. */
export interface PackMinimapSvg extends PackImage {
  readonly boundsCells: CellBounds;
}

export interface PackImages {
  readonly thumbnail?: PackImage;
  readonly minimap?: PackImage;
  readonly customMinimap?: PackImage;
  readonly customMinimapSvg?: PackMinimapSvg;
  readonly customMinimapHover?: PackImage;
  readonly replayPreview?: PackImage;
  readonly mapSelect?: PackImage;
  readonly loadingScreen?: PackImage;
}

/** Where a standing neighbour is in front of a cut-out: opaque where it hides it. */
export interface HiddenByMask {
  /** The neighbouring structure's id. */
  readonly id: number;
  readonly file: string;
}

/** One state's cut-out, and where it goes on its map layer: left, top, width, height. */
export interface ElementCut {
  readonly file: string;
  readonly rect: readonly [left: number, top: number, width: number, height: number];
  readonly hiddenBy?: readonly HiddenByMask[];
}

export type StructureState = 'standing' | 'rubble';
export type CampState = 'spawned';

export interface PackStructure {
  readonly id: number;
  readonly type: string;
  readonly cell: Cell;
  readonly owner: 'order' | 'chaos' | null;
  readonly town: number | null;
  readonly core: boolean;
  /** `null`: nothing is left of it in that state; missing: that state couldn't be shot. */
  readonly states: Partial<Record<StructureState, ElementCut | null>>;
}

export interface PackCamp {
  readonly camp: number;
  readonly type: string;
  readonly cell: Cell;
  readonly states: Partial<Record<CampState, ElementCut | null>>;
}

/** The elements render's structures and camps, each cut out on its own. */
export interface PackElements {
  /** The map layer the cut-outs belong to (their rectangles are in its pixels). */
  readonly layer: string;
  readonly structures: readonly PackStructure[];
  readonly camps: readonly PackCamp[];
}

export interface MapPack {
  readonly format: number;
  readonly tool: string;
  readonly gameBuild: number | null;
  readonly map: {
    readonly id: string;
    readonly name: string;
    readonly category: string | null;
    readonly validated: boolean;
    readonly structures: 'keep' | 'hide' | 'elements';
    readonly sizeCells: Pixels;
    readonly cameraBounds?: CellBounds;
  };
  readonly arenas: readonly PackArena[] | null;
  /** Back to front: the drawing order. */
  readonly layers: readonly PackLayer[];
  readonly images: PackImages;
  readonly data: { readonly elements?: PackElements };
}
