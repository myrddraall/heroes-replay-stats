import type { LayerSlot } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { AddedLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import type { TreeRow } from '../tree/scene-tree';
import { LAYER_NAMES, type MaterialEntry } from './materials';
import { lightIcon, shieldOf } from '../lights/lights';

/**
 * What of a material a row shows, where it isn't the material itself: one of its layers; the
 * shield shader it is drawn with (its pattern); one of that shader's lights (by its id).
 */
export type MaterialView =
  | { readonly kind: 'layer'; readonly slot: LayerSlot }
  | { readonly kind: 'shader' }
  | { readonly kind: 'gridLight'; readonly id: AddedLight['id'] };

const VIEW = '::';

/** A row's key for what of a material it shows (its own key and the view after `::`). */
export function viewKey(materialKey: string, view: MaterialView): string {
  const what =
    view.kind === 'layer'
      ? `layer:${view.slot}`
      : view.kind === 'gridLight'
        ? `light:${view.id}`
        : 'shader';
  return `${materialKey}${VIEW}${what}`;
}

/** A shield shader's groups' keys (they only fold): its materials, its lights. */
export const shaderGroupKey = (materialKey: string, group: 'materials' | 'lights') =>
  `${materialKey}${VIEW}group:${group}`;

/**
 * A row's key split into its material's and what of it it shows; a shader's group's into its
 * material's and `group`; none where it is a material's own (or not a material's at all).
 */
export function splitViewKey(
  key: string,
): { readonly base: string; readonly view: MaterialView | 'group' } | null {
  const at = key.lastIndexOf(VIEW);
  if (at < 0) return null;
  const base = key.slice(0, at);
  const what = key.slice(at + VIEW.length);
  if (what === 'shader') return { base, view: { kind: 'shader' } };
  if (what.startsWith('group:')) return { base, view: 'group' };
  if (what.startsWith('light:'))
    return { base, view: { kind: 'gridLight', id: what.slice(6) as AddedLight['id'] } };
  if (what.startsWith('layer:')) {
    const slot = what.slice(6) as LayerSlot;
    return LAYER_SLOTS.includes(slot) ? { base, view: { kind: 'layer', slot } } : null;
  }
  return null;
}

const LAYER_SLOTS: readonly LayerSlot[] = ['diffuse', 'emissive', 'mask1', 'mask2'];

/** A view's title: its shader, its light, or its layer (by the material's own name for it, where given). */
export function viewTitle(view: MaterialView, m?: MaterialEntry): string {
  if (view.kind === 'shader') return 'Shield shader';
  if (view.kind === 'gridLight')
    return m?.values.gridLights.find((l) => l.id === view.id)?.name ?? 'Light';
  const layer = m?.layers.find((l) => l.slot === view.slot)?.label ?? LAYER_NAMES[view.slot];
  return m ? `${m.label} · ${layer}` : layer;
}

/** A material's layers as rows under its own (each showing that layer). */
export function layerRows(materialKey: string, m: MaterialEntry, depth: number): TreeRow[] {
  return m.layers.map((l) => ({
    key: viewKey(materialKey, { kind: 'layer', slot: l.slot }),
    label: l.label,
    icon: 'layers',
    depth,
    expandable: false,
    expanded: false,
  }));
}

/**
 * A part's materials as rows under it: a shield's (a grid's) under its shader, the shader's
 * materials and its lights (where it shows, where it is active) under that, each its own row
 * (open unless folded: their keys among those kept mean folded); any other part's materials
 * right under it. Each material's row is the editor's own (`material`, at a depth), its layers
 * under it.
 */
export function partMaterialRows(
  materials: readonly MaterialEntry[],
  depth: number,
  open: ReadonlySet<string>,
  keyOf: (name: string) => string,
  material: (key: string, m: MaterialEntry, depth: number) => void,
  push: (row: TreeRow) => void,
): void {
  const grid = shieldOf(materials);
  if (!grid) {
    for (const m of materials) material(keyOf(m.name), m, depth);
    return;
  }
  const base = keyOf(grid.name);
  const shader = viewKey(base, { kind: 'shader' });
  push({
    key: shader,
    label: 'Shield shader',
    icon: 'hexagon',
    depth,
    expandable: true,
    expanded: !open.has(shader),
  });
  if (open.has(shader)) return;
  const group = (which: 'materials' | 'lights', label: string, icon: string) => {
    const key = shaderGroupKey(base, which);
    push({
      key,
      label,
      icon,
      depth: depth + 1,
      expandable: true,
      expanded: !open.has(key),
      group: true,
    });
    return !open.has(key);
  };
  if (group('materials', 'Materials', 'texture'))
    for (const m of materials) material(keyOf(m.name), m, depth + 2);
  if (group('lights', 'Lights', 'lightbulb'))
    for (const l of grid.values.gridLights)
      push({
        key: viewKey(base, { kind: 'gridLight', id: l.id }),
        label: l.name,
        icon: lightIcon(l),
        depth: depth + 2,
        expandable: false,
        expanded: false,
        enabled: l.enabled ?? true,
      });
}
