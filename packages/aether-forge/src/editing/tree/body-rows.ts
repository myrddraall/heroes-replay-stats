import type { PartKey } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { LightId } from '@myrddraall/heroes-replay-stats-aether/lights';
import type { TreeRow } from '../../tree/scene-tree';
import { type BodyInfo, overlayEnabled, overlayLabel } from '../model/body';
import { lightIcon, type LightEntry, lightsOfBody } from '../model/lights';
import { type MaterialEntry, materialsOf, onPart, sharedMaterials } from '../model/materials';
import { partIcon, type PartNode, partNodes } from '../model/parts';
import { layerRows, partMaterialRows } from '../model/views';

/** How an editor keys the rows of a body's subtree (each editor's own scheme: see its targets). */
export interface BodyRowKeys {
  part(part: PartKey): string;
  /** A material's row, on the body's own parts or on an overlay's (by the overlay's id). */
  material(name: string, overlay?: string): string;
  /** The group of the body's own lights, or of an overlay's (by its id). */
  lights(overlay?: string): string;
  light(id: LightId): string;
  overlay(id: string): string;
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
 * A body's subtree, under its own row: its parts, each with the materials drawn on it (a part is
 * open unless folded: its key among those kept means folded); its lights; then each overlay it
 * wears, in the order worn (the later drawn over the earlier), its parts and its lights under it.
 * Overlays are `movable` (worn in another order by moving them) where the editor lets them be.
 */
export function bodySubtreeRows(
  b: BodyInfo,
  depth: number,
  open: ReadonlySet<string>,
  keys: BodyRowKeys,
  options: { readonly movableOverlays: boolean },
): TreeRow[] {
  const rows: TreeRow[] = [];
  const material = (key: string, m: MaterialEntry, at: number) =>
    rows.push(...materialRows(key, m, at, open));
  const nodes = partNodes(b, materialsOf(b));
  const lights = lightsOfBody(b);
  const parts = (list: readonly PartNode[], at: number, overlay?: string) => {
    const shared = sharedMaterials(list);
    for (const { part, materials } of list) {
      const key = keys.part(part.key);
      rows.push({
        key,
        label: part.label,
        icon: partIcon(part),
        depth: at,
        expandable: materials.length > 0,
        expanded: !open.has(key),
        enabled: part.enabled,
      });
      if (!open.has(key))
        partMaterialRows(
          materials,
          at + 1,
          open,
          (name) => onPart(keys.material(name, overlay), shared.has(name) ? part.key : undefined),
          material,
          (r) => rows.push(r),
        );
    }
  };
  const lightGroup = (group: string, list: readonly LightEntry[], at: number) => {
    if (!list.length) return;
    rows.push({
      key: group,
      label: 'Lights',
      icon: 'lightbulb',
      depth: at,
      expandable: true,
      expanded: open.has(group),
      group: true,
    });
    if (open.has(group))
      for (const { light } of list)
        rows.push({
          key: keys.light(light.id),
          label: light.name,
          icon: lightIcon(light),
          depth: at + 1,
          expandable: false,
          expanded: false,
          enabled: light.enabled,
        });
  };
  parts(nodes.own, depth + 1);
  lightGroup(
    keys.lights(),
    lights.filter((l) => !l.overlay),
    depth + 1,
  );
  for (const { overlay, nodes: list } of nodes.overlays) {
    const group = keys.overlay(overlay.id);
    rows.push({
      key: group,
      label: overlayLabel(overlay),
      detail: 'overlay',
      icon: 'style',
      depth: depth + 1,
      expandable: true,
      expanded: !open.has(group),
      group: true,
      enabled: overlayEnabled(b, overlay.id),
      ...(options.movableOverlays ? { movable: b.overlays.length > 1 } : {}),
    });
    if (!open.has(group)) {
      parts(list, depth + 2, overlay.id);
      lightGroup(
        keys.lights(overlay.id),
        lights.filter((l) => l.overlay === overlay.id),
        depth + 2,
      );
    }
  }
  return rows;
}
