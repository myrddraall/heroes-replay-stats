/**
 * A heroes-capture map pack, format 6: what its `pack.json` holds. heroes-capture's PACK.md is
 * the contract; only what a viewer reads is typed here.
 */
export const MAP_PACK_FORMAT = 6;

/** A colour, red, green and blue, 0 to 255. */
export type Rgb = readonly [number, number, number];

/**
 * Team colour (PACK.md, Team colour): the colours the pack's pictures have their teams in (Order's
 * team as the ally's blue, Chaos's as the enemy's red), and how much of a team's colour a mask byte
 * of 255 is.
 */
export interface PackTeamColours {
  readonly order: Rgb;
  readonly chaos: Rgb;
  readonly maskScale: number;
}

/**
 * A map layer's team-colour mask: a pyramid tiled and levelled as the layer (Order's team's amount
 * in red, Chaos's in green), and its overview.
 */
export interface PackTeamMask {
  readonly file: string;
  readonly overview: PackOverview;
}

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

/**
 * One of a tiled layer's pyramid levels whole, as one picture (PACK.md, Overviews): the level the
 * opening view draws the layer at. The layer's PMTiles archive holds only the levels finer than it
 * (but on a layer of one level); a viewer draws nothing coarser.
 */
export interface PackOverview {
  readonly file: string;
  /** The pyramid level, 0 the coarsest. */
  readonly level: number;
  readonly size: Pixels;
}

/** What every tiled layer has: a pyramid of `levels` levels, its overview and the finer levels' PMTiles archive. */
interface TiledLayer {
  readonly id: string;
  readonly file: string;
  readonly size: Pixels;
  readonly levels: number;
  readonly tileSize: number;
  readonly overview: PackOverview;
  /** Where the layer is drawn in a team's colour (the map, where it has team-coloured doodads). */
  readonly teamMask?: PackTeamMask;
  /** How the layer moves with the camera: 1 for the map, less for the sky behind it. */
  readonly rate: number;
  readonly pxPerCell: number;
}

/**
 * A sky layer (background art, haze): placed from the cell its picture is centred on. Its picture
 * fills its whole rectangle (PACK.md, Sky layers fill their rectangles): a window inside it shows
 * no edge of the sky.
 */
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
  readonly customMinimapSvg?: PackMinimapSvg;
}

/** Where a standing neighbour is in front of a cut-out: a mask in the `masks` atlas, opaque where it hides it. */
export interface HiddenByMask {
  /** The neighbouring structure's id. */
  readonly id: number;
  /** The mask's top-left corner in the `masks` atlas; it is the cut-out's size. */
  readonly at: Pixels;
}

/** The atlases the cut-outs are packed in (PACK.md, Elements). */
export type ElementAtlasName = 'standing' | 'rubble' | 'masks' | 'small' | 'team' | 'teamSmall';

export interface PackAtlas {
  readonly file: string;
  readonly size: Pixels;
  /** The atlas's pixels per map layer pixel: 1, or the overview's scale for `small`. */
  readonly scale: number;
}

/**
 * One state's cut-out: where it goes on its map layer (`rect`: left, top, width, height), its
 * picture's top-left corner in its full-scale atlas (`atlas`, `at`), and in the `small` atlas
 * (`small`, where it is ⌈width · scale⌉ by ⌈height · scale⌉).
 */
export interface ElementCut {
  readonly rect: readonly [left: number, top: number, width: number, height: number];
  readonly atlas: 'standing' | 'rubble';
  readonly at: Pixels;
  readonly small: Pixels;
  readonly hiddenBy?: readonly HiddenByMask[];
  /** A standing state's team-colour mask: its top-left corner in the `team` atlas and in `teamSmall`. */
  readonly teamMask?: { readonly at: Pixels; readonly small: Pixels };
}

export type StructureState = 'standing' | 'rubble';
export type CampState = 'spawned';

export interface PackStructure {
  readonly id: number;
  readonly type: string;
  readonly cell: Cell;
  readonly owner: 'order' | 'chaos' | null;
  /** The game's town (a region of the map) it stands in; `null`: the cores, anything outside. */
  readonly town: number | null;
  /** The outpost it belongs to; `null`: its town hall's ring, or no outpost. */
  readonly outpost: number | null;
  readonly core: boolean;
  /** `null`: nothing is left of it in that state; missing: that state couldn't be shot. */
  readonly states: Partial<Record<StructureState, ElementCut | null>>;
}

/**
 * A town's structures beyond its hall's ring, grouped by nearness: the lane's forward towers,
 * gate and fountain. Numbered in town order, nearest the hall first.
 */
export interface PackOutpost {
  readonly outpost: number;
  readonly town: number;
  readonly lane: number | null;
  readonly owner: 'order' | 'chaos' | null;
  /** The middle of its structures. */
  readonly cell: Cell;
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
  readonly atlases: Readonly<Partial<Record<ElementAtlasName, PackAtlas>>>;
  readonly structures: readonly PackStructure[];
  readonly outposts: readonly PackOutpost[];
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
  /** Every file in the pack, its size and SHA-256 (`pack.json` aside). */
  readonly files?: Readonly<Record<string, { readonly bytes: number; readonly sha256: string }>>;
  /** Back to front: the drawing order. */
  readonly layers: readonly PackLayer[];
  readonly images: PackImages;
  readonly data: { readonly elements?: PackElements };
  readonly teamColours: PackTeamColours;
}
