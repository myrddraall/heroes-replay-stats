import type { VariantRow } from '../variants/variant-list';
import type { PartKey } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { LightId } from '@myrddraall/heroes-replay-stats-aether/lights';
import { OPAQUE_ICON, SEE_THROUGH_ICON, type TreeRow } from '../tree/scene-tree';
import {
  type BodyCategory,
  type BodyInfo,
  CATEGORY_TITLES,
  overlayEnabled,
  overlayLabel,
} from './body';
import { lightDetail, lightIcon, lightsOfBody } from '../lights/lights';
import { type MaterialEntry, materialsOf, onPart, sharedMaterials } from '../materials/materials';
import { movableShape, partIcon, type PartNode, partsInDrawOrder } from '../parts/parts';
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
  readonly variantEdited?: string | null;
  /**
   * Which of its categories can be added to here: each shown with nothing in it yet (to add the
   * first), where the others are shown only with something in them.
   */
  readonly adds?: Partial<Record<BodyCategory, boolean>>;
  /** An overlay it wears: that overlay's shapes and lights alone (what an editor inside it shows). */
  readonly only?: string;
}

/**
 * A material's row (movable: its draw order, among those drawn as it is, opaque or blended; the
 * opaque are drawn first), its layers under it while it is unfolded.
 */
export function materialRows(
  key: string,
  m: MaterialEntry,
  depth: number,
  open: ReadonlySet<string>,
  unsaved?: boolean,
  movable = true,
): TreeRow[] {
  return [
    {
      key,
      label: m.label,
      detail: m.name,
      // (Opaque: a solid square; see-through, a checkerboard.)
      ...(m.values.blend === 'opaque' ? { icon: OPAQUE_ICON } : { icon: SEE_THROUGH_ICON }),
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
 * A body's subtree, under its own row, in categories, each shown where it has anything in it or
 * where it can be added to (selected, a category shows what adds to it):
 * its Shapes (its parts and its overlays' in one list, in the order they are drawn, each of an
 * overlay marked with its name and each with the materials drawn on it; moved to draw them in
 * another order), its Lights (its own and its overlays', marked so), the Overlays it wears (in
 * the order worn), its Variants, and its
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
  /** A category's row (selected, it shows what adds to it): unfolding where it has rows under it. */
  const category = (key: string, label: string, icon: string, expanded: boolean, has: boolean) =>
    rows.push({ key, label, icon, depth: at, expandable: has, expanded: has && expanded });
  const { only } = options;
  const adds = only ? {} : (options.adds ?? {});
  const material = (key: string, m: MaterialEntry, d: number) =>
    rows.push(...materialRows(key, m, d, open));
  const all = materialsOf(b);
  const nodes = partsInDrawOrder(b, all).filter((n) => !only || n.part.overlay === only);
  const labels = new Map(b.overlays.map((o) => [o.id, overlayLabel(o)] as const));
  // (A material drawn on more than one of its owner's parts is told apart by the part too.)
  const owners = new Map<string, PartNode[]>();
  for (const n of nodes)
    owners.set(n.part.overlay ?? '', [...(owners.get(n.part.overlay ?? '') ?? []), n]);
  const shared = new Map([...owners].map(([owner, list]) => [owner, sharedMaterials(list)]));
  const shapes = nodes.length > 0;
  if (shapes || adds.shapes) {
    category(keys.shapes(), CATEGORY_TITLES.shapes, 'shapes', !open.has(keys.shapes()), shapes);
    if (!open.has(keys.shapes()))
      // In the order they are drawn, the planet's own and its overlays' together (the later over
      // the earlier), each marked with the overlay it is of.
      for (const node of nodes) {
        const { part, materials } = node;
        const overlay = part.overlay;
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
          movable: movableShape(node),
        });
        if (!open.has(key))
          partMaterialRows(
            materials,
            at + 2,
            open,
            (name) =>
              onPart(
                keys.material(name, overlay),
                shared.get(overlay ?? '')?.has(name) ? part.key : undefined,
              ),
            material,
            (r) => rows.push(r),
          );
      }
  }
  const lights = lightsOfBody(b).filter((l) => !only || l.overlay === only);
  if (lights.length || adds.lights) {
    category(
      keys.lights(),
      CATEGORY_TITLES.lights,
      'lightbulb',
      open.has(keys.lights()),
      lights.length > 0,
    );
    if (open.has(keys.lights()))
      for (const { light, overlay } of lights)
        rows.push({
          key: keys.light(light.id),
          label: light.name,
          ...withDetail(lightDetail(light, overlay && (labels.get(overlay) ?? overlay))),
          icon: lightIcon(light),
          depth: at + 1,
          expandable: false,
          expanded: false,
          enabled: light.enabled,
        });
  }
  if (!only && (b.overlays.length || adds.overlays)) {
    category(
      keys.overlays(),
      CATEGORY_TITLES.overlays,
      'style',
      !open.has(keys.overlays()),
      b.overlays.length > 0,
    );
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
  if (!only && (variants.length || adds.variants)) {
    category(
      keys.variants(),
      CATEGORY_TITLES.variants,
      'layers',
      open.has(keys.variants()),
      variants.length > 0,
    );
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
  const moons = only ? [] : (options.moons?.(at + 1) ?? []);
  if (moons.length || adds.moons) {
    category(
      keys.moons(),
      CATEGORY_TITLES.moons,
      'brightness_1',
      !open.has(keys.moons()),
      moons.length > 0,
    );
    if (!open.has(keys.moons())) rows.push(...moons);
  }
  return rows;
}

/** A row's detail, where it has one. */
const withDetail = (detail: string | undefined) => (detail ? { detail } : {});
