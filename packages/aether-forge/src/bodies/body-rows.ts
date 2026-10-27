import type { VariantRow } from '../variants/variant-list';
import type { PartKey } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { LightId } from '@myrddraall/heroes-replay-stats-aether/lights';
import type { TreeRow } from '../tree/scene-tree';
import { type BodyInfo, overlayEnabled, overlayLabel } from './body';
import { lightIcon, lightsOfBody } from '../lights/lights';
import { type MaterialEntry, materialsOf, onPart, sharedMaterials } from '../materials/materials';
import { partIcon, type PartNode, partNodes } from '../parts/parts';
import { layerRows, partMaterialRows } from '../materials/material-views';

/** How an editor keys the rows of a body's subtree (each editor's own scheme: see its targets). */
export interface BodyRowKeys {
  part(part: PartKey): string;
  /** A material's row, on the body's own parts or on an overlay's (by the overlay's id). */
  material(name: string, overlay?: string): string;
  light(id: LightId): string;
  overlay(id: string): string;
  variant(id: string): string;
  /** Its categories: its shapes, its lights, the overlays it wears, its variants, its moons. */
  shapes(): string;
  lights(): string;
  overlays(): string;
  variants(): string;
  moons(): string;
}

/** What else a body's subtree shows, as its editor has it. */
export interface BodyRowOptions {
  /** Whether its overlays can be dragged into another order (worn in another order). */
  readonly movableOverlays: boolean;
  /** Its moons' rows, at the depth given (none: no Moons). */
  readonly moons?: (depth: number) => readonly TreeRow[];
  /** Its variants, each on or off where it is, and the one open to be edited. */
  readonly variants?: readonly VariantRow[];
  /** Whether variants are made here (its Variants shown with none yet, to make the first). */
  readonly variantsMade?: boolean;
  readonly variantEdited?: string | null;
}

/**
 * A material's row (movable, its draw order, unless opaque: drawn first wherever it is), its
 * layers under it while it is unfolded.
 */
export function materialRows(
  key: string,
  m: MaterialEntry,
  depth: number,
  open: ReadonlySet<string>,
  unsaved?: boolean,
  movable = m.values.blend !== 'opaque',
): TreeRow[] {
  return [
    {
      key,
      label: m.label,
      detail: m.name,
      icon: 'texture',
      depth,
      expandable: m.layers.length > 0,
      expanded: open.has(key),
      enabled: m.values.enabled,
      ...(unsaved !== undefined ? { unsaved } : {}),
      movable,
    },
    ...(open.has(key) ? layerRows(key, m, depth + 1) : []),
  ];
}

/**
 * A body's subtree, under its own row, in categories, each shown where it has anything in it:
 * its Shapes (its parts, then those of each overlay it wears, marked with the overlay's name,
 * each with the materials drawn on it), its Lights (its own and its overlays', marked so), the
 * Overlays it wears (in the order worn: the later drawn over the earlier), its Variants, and its
 * Moons. Shapes, Overlays and Moons start unfolded (a key kept means folded), Lights and Variants
 * folded (a key kept means unfolded); a part is unfolded unless folded.
 */
export function bodySubtreeRows(
  b: BodyInfo,
  depth: number,
  open: ReadonlySet<string>,
  keys: BodyRowKeys,
  options: BodyRowOptions,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const at = depth + 1;
  /** A category's row: it only groups the rows under it. */
  const category = (key: string, label: string, icon: string, expanded: boolean) =>
    rows.push({ key, label, icon, depth: at, expandable: true, expanded, group: true });
  const material = (key: string, m: MaterialEntry, d: number) =>
    rows.push(...materialRows(key, m, d, open));
  const nodes = partNodes(b, materialsOf(b));
  const labels = new Map(b.overlays.map((o) => [o.id, overlayLabel(o)] as const));
  const parts = (list: readonly PartNode[], overlay?: string) => {
    const shared = sharedMaterials(list);
    for (const { part, materials } of list) {
      const key = keys.part(part.key);
      rows.push({
        key,
        label: part.label,
        ...(overlay ? { detail: labels.get(overlay) ?? overlay } : {}),
        icon: partIcon(part),
        depth: at + 1,
        expandable: materials.length > 0,
        expanded: !open.has(key),
        enabled: part.enabled,
      });
      if (!open.has(key))
        partMaterialRows(
          materials,
          at + 2,
          open,
          (name) => onPart(keys.material(name, overlay), shared.has(name) ? part.key : undefined),
          material,
          (r) => rows.push(r),
        );
    }
  };
  if (nodes.own.length || nodes.overlays.some((o) => o.nodes.length)) {
    category(keys.shapes(), 'Shapes', 'shapes', !open.has(keys.shapes()));
    if (!open.has(keys.shapes())) {
      parts(nodes.own);
      for (const { overlay, nodes: list } of nodes.overlays) parts(list, overlay.id);
    }
  }
  const lights = lightsOfBody(b);
  if (lights.length) {
    category(keys.lights(), 'Lights', 'lightbulb', open.has(keys.lights()));
    if (open.has(keys.lights()))
      for (const { light, overlay } of lights)
        rows.push({
          key: keys.light(light.id),
          label: light.name,
          ...(overlay ? { detail: labels.get(overlay) ?? overlay } : {}),
          icon: lightIcon(light),
          depth: at + 1,
          expandable: false,
          expanded: false,
          enabled: light.enabled,
        });
  }
  if (b.overlays.length) {
    category(keys.overlays(), 'Overlays', 'style', !open.has(keys.overlays()));
    if (!open.has(keys.overlays()))
      for (const overlay of b.overlays)
        rows.push({
          key: keys.overlay(overlay.id),
          label: overlayLabel(overlay),
          icon: 'style',
          depth: at + 1,
          expandable: false,
          expanded: false,
          enabled: overlayEnabled(b, overlay.id),
          ...(options.movableOverlays ? { movable: b.overlays.length > 1 } : {}),
        });
  }
  const variants = options.variants ?? [];
  if (variants.length || options.variantsMade) {
    // (Selected, it lists them with what makes new ones.)
    rows.push({
      key: keys.variants(),
      label: 'Variants',
      icon: 'layers',
      depth: at,
      expandable: variants.length > 0,
      expanded: open.has(keys.variants()),
    });
    if (open.has(keys.variants()))
      for (const v of variants)
        rows.push({
          key: keys.variant(v.id),
          label: v.name,
          ...(v.id === options.variantEdited ? { detail: 'editing' } : {}),
          icon: 'layers',
          depth: at + 1,
          expandable: false,
          expanded: false,
          enabled: v.on,
        });
  }
  const moons = options.moons?.(at + 1) ?? [];
  if (moons.length) {
    category(keys.moons(), 'Moons', 'brightness_1', !open.has(keys.moons()));
    if (!open.has(keys.moons())) rows.push(...moons);
  }
  return rows;
}
