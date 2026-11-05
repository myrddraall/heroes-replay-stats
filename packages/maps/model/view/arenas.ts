import type { Cell, CellBounds, PackMapLayer, MapPack } from '../pack/map-pack';

/** An arena as the viewer shows it: one map layer, the whole map unless the pack has several. */
export interface Arena {
  readonly label: string;
  /** Its map layer. */
  readonly layer: PackMapLayer;
  /** The map layer's extent, in map cells. */
  readonly west: number;
  readonly east: number;
  readonly north: number;
  readonly south: number;
  /** The cell the sky is anchored to while this arena is shown (`null`: each sky layer's own). */
  readonly skyAnchor: Cell | null;
  /** Where the camera starts. */
  readonly middle: Cell;
  /** Where the camera may go. */
  readonly bounds: CellBounds;
  /** On a map of several arenas, the part of the custom minimap that belongs to this one. */
  readonly minimapClip: CellBounds | null;
}

/** How far past its bounds an arena's part of the minimap reaches, in cells. */
export const MINIMAP_MARGIN = 16;

/** The pack's arenas (PACK.md, Several arenas); one, the whole map, if it has no `arenas`. */
export function arenasOf(pack: MapPack): readonly Arena[] {
  const maps = pack.layers.filter((l): l is PackMapLayer => l.kind === 'map');
  const first = maps[0];
  if (!first) throw new Error(`${pack.map.id}'s pack has no map layer`);
  const arenas = (pack.arenas ?? [{ id: 'map', layer: first.id }]).map((a, k): Arena => {
    const layer = maps.find((m) => m.id === a.layer);
    if (!layer) throw new Error(`${pack.map.id}'s arena ${a.id} names no map layer (${a.layer})`);
    const west = layer.originCell[0];
    const north = layer.originCell[1];
    const east = west + layer.size[0] / layer.pxPerCell;
    const south = north - layer.size[1] / layer.pxPerCell;
    const middle = a.middleCell ?? [(west + east) / 2, (north + south) / 2];
    return {
      label: a.label ?? `Arena ${k + 1}`,
      layer,
      west,
      east,
      north,
      south,
      skyAnchor: pack.arenas ? middle : null,
      middle,
      bounds: a.boundsCells ??
        pack.map.cameraBounds ?? { left: west, right: east, bottom: south, top: north },
      minimapClip: null,
    };
  });
  if (!pack.arenas) return arenas;
  return arenas.map((a) => ({ ...a, minimapClip: minimapClip(a, arenas) }));
}

/**
 * On a map of several arenas the custom minimap shows them all: each arena shows its own, out to
 * a margin past its bounds, but no nearer another arena than halfway to it.
 */
function minimapClip(arena: Arena, all: readonly Arena[]): CellBounds {
  const b = arena.bounds;
  let { left, right, bottom, top } = {
    left: b.left - MINIMAP_MARGIN,
    right: b.right + MINIMAP_MARGIN,
    bottom: b.bottom - MINIMAP_MARGIN,
    top: b.top + MINIMAP_MARGIN,
  };
  for (const other of all) {
    if (other === arena) continue;
    const o = other.bounds;
    if (o.left < b.right && o.right > b.left) {
      // above or below this one
      if (o.top <= b.bottom) bottom = Math.max(bottom, (o.top + b.bottom) / 2);
      if (o.bottom >= b.top) top = Math.min(top, (o.bottom + b.top) / 2);
    }
    if (o.bottom < b.top && o.top > b.bottom) {
      // beside it
      if (o.right <= b.left) left = Math.max(left, (o.right + b.left) / 2);
      if (o.left >= b.right) right = Math.min(right, (o.left + b.right) / 2);
    }
  }
  return { left, right, bottom, top };
}
