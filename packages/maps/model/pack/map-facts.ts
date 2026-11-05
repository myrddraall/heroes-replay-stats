import { arenasOf } from '../view/arenas';
import type { CellBounds, MapPack, Pixels } from './map-pack';

/** What the pack says about the map, as a panel shows it. */
export interface MapFacts {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly gameBuild: number | null;
  /** The heroes-capture version that rendered it. */
  readonly tool: string;
  readonly validated: boolean;
  readonly sizeCells: Pixels;
  /** The playable area: the camera bounds, when the pack has them. */
  readonly playable: CellBounds | null;
  /** The arenas' labels (one, "Arena 1", on a map with a single one). */
  readonly arenas: readonly string[];
  readonly counts: {
    readonly structures: number;
    readonly towns: number;
    readonly camps: number;
    readonly cores: number;
  };
}

export function mapFactsOf(pack: MapPack): MapFacts {
  const elements = pack.data.elements;
  const structures = elements?.structures ?? [];
  return {
    id: pack.map.id,
    name: pack.map.name,
    category: pack.map.category,
    gameBuild: pack.gameBuild,
    tool: pack.tool,
    validated: pack.map.validated,
    sizeCells: pack.map.sizeCells,
    playable: pack.map.cameraBounds ?? null,
    arenas: arenasOf(pack).map((a) => a.label),
    counts: {
      structures: structures.length,
      towns: new Set(structures.map((s) => s.town).filter((t) => t !== null)).size,
      camps: elements?.camps.length ?? 0,
      cores: structures.filter((s) => s.core).length,
    },
  };
}
