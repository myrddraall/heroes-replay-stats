import type { MapPack } from '../pack/map-pack';

/** Where a layer sits: its place in the stack (higher is in front) and its parallax rate. */
export interface LayerPlacement {
  /** Back to front; layers with a higher order are drawn over those with a lower one. */
  readonly order: number;
  /**
   * How the layer moves with the camera (PACK.md, Layers and drawing): 1 with the map, less for
   * a plane further back, 0 not at all (fixed to the screen).
   */
  readonly rate: number;
}

export type StackedKind = 'fixed' | 'tiles' | 'elements' | 'minimap';

/** One of the pack's own layers in the stack. */
export interface StackedLayer extends LayerPlacement {
  /** `fixed`, a sky layer's id, `map` (the terrain: every arena's map layer), `elements`, `minimap`. */
  readonly id: string;
  readonly kind: StackedKind;
}

/** The step between the pack's layers' orders, leaving room for other layers in between. */
export const ORDER_STEP = 10;
/** Where a layer that names no order goes: in front of everything in the pack. */
export const DEFAULT_ORDER = 1000;
/** How a layer that names no rate moves: with the map. */
export const DEFAULT_RATE = 1;

/**
 * The pack's layers as the viewer stacks them, back to front: its `layers` in the order it lists
 * them (every map layer as one, the terrain), then the elements and the custom minimap just in
 * front of the terrain.
 */
export function packStack(pack: MapPack): StackedLayer[] {
  const stack: StackedLayer[] = [];
  for (const layer of pack.layers) {
    const id = layer.kind === 'map' ? 'map' : layer.id;
    if (stack.some((s) => s.id === id)) continue;
    const rate = layer.kind === 'fixed' ? 0 : layer.kind === 'map' ? 1 : layer.rate;
    const kind = layer.kind === 'fixed' ? 'fixed' : 'tiles';
    stack.push({ id, kind, order: stack.length * ORDER_STEP, rate });
  }
  const terrain = stack.find((s) => s.id === 'map')?.order ?? stack.length * ORDER_STEP;
  if (pack.data.elements)
    stack.push({ id: 'elements', kind: 'elements', order: terrain + 1, rate: 1 });
  if (pack.images.customMinimapSvg) {
    stack.push({ id: 'minimap', kind: 'minimap', order: terrain + 2, rate: 1 });
  }
  return stack;
}

/** A number, or a numeric attribute (`order="35"`); `null` otherwise. */
function numberOf(value: number | string | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A layer's placement from what it says: a number, or one of the pack's layers by id. As the
 * order, a layer id puts it just in front of that layer; as the rate, it moves with that layer.
 * Anything else (nothing, an id the pack doesn't have) takes the default.
 */
export function resolvePlacement(
  order: number | string | undefined,
  rate: number | string | undefined,
  stack: readonly StackedLayer[],
): LayerPlacement {
  const byId = (id: number | string | undefined) =>
    typeof id === 'string' ? stack.find((s) => s.id === id) : undefined;
  const above = byId(order);
  return {
    order: numberOf(order) ?? (above ? above.order + 0.5 : DEFAULT_ORDER),
    rate: numberOf(rate) ?? byId(rate)?.rate ?? DEFAULT_RATE,
  };
}
