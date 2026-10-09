import type { Pixels } from './map-pack';

/** One map in heroes-maps' catalog (`maps/index.json`); paths are relative to the catalog. */
export interface MapCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly gameBuild: number | null;
  /** The heroes-capture version that rendered it. */
  readonly tool: string;
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
