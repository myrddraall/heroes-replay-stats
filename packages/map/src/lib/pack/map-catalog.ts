import { MAP_PACK_FORMAT, type Pixels } from './map-pack';

/** One map in heroes-maps' catalog (`maps/index.json`); paths are relative to the catalog. */
export interface MapCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly gameBuild: number | null;
  /** The heroes-capture version that rendered it. */
  readonly tool: string;
  /** The pack's format (PACK.md); a catalog written before it had this says nothing. */
  readonly packFormat?: number;
  readonly structures: 'keep' | 'hide' | 'elements' | null;
  /** The pack's folder. */
  readonly path: string;
  /** Its `pack.json`. */
  readonly pack: string;
  readonly thumbnail: { readonly file: string; readonly size: Pixels } | null;
}

export interface MapCatalog {
  readonly format: number;
  readonly maps: readonly MapCatalogEntry[];
}

/**
 * The catalog's maps this viewer can read: those of its pack format, and those the catalog
 * doesn't give a format for (a deep link to one of those still opens the pack, which says).
 */
export function readableMaps(catalog: MapCatalog): readonly MapCatalogEntry[] {
  return catalog.maps.filter((m) => m.packFormat === undefined || m.packFormat === MAP_PACK_FORMAT);
}
