import {
  pathKey,
  setOverlays,
  withoutMaterial,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { reordered } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import { wornIds, wornKeyOf } from '../bodies/body';
import { materialAt, materialsOf, movedInPart, movedShape } from '../materials/materials';
import type { TreeMove } from '../tree/scene-tree';
import { bodyKey, targetOf } from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** A body's materials: their order and settings. */
export function materialMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, edit, settings, materialChange } = w;
  return {
    moveMaterial(move: TreeMove): void {
      const from = targetOf(move.key);
      const to = targetOf(move.target);
      // An overlay moved among those the sky wears: worn in that order.
      if (from.kind === 'group' && to.kind === 'group' && from.skyOverlay && to.skyOverlay) {
        const worn = store.skyWorn();
        d.setSkyOverlays(
          store.scene(),
          reordered(worn, worn, from.skyOverlay, to.skyOverlay, move.after),
        );
        return;
      }
      // An overlay moved among those its body wears: worn in that order (its shapes stay where
      // they are drawn: they are moved among the Shapes).
      if (
        from.kind === 'overlay' &&
        to.kind === 'overlay' &&
        pathKey(from.path) === pathKey(to.path)
      ) {
        const b = store.bodyByKey().get(bodyKey(from.path));
        if (!b) return;
        const worn = wornIds(b);
        const next = reordered(worn, worn, from.id, to.id, move.after);
        edit((bodies) => setOverlays(bodies, from.path, next, wornKeyOf(b)));
        return;
      }
      if (from.kind === 'sky-material' && to.kind === 'sky-material') {
        const all = store.skyMaterials();
        const moving = materialAt(all, from.key);
        const target = materialAt(all, to.key);
        if (!moving || !target) return;
        const depth = target.values.depth;
        const group = all.filter((m) => m.values.depth === depth).map((m) => m.key);
        const order = reordered(
          all.map((m) => m.key),
          group,
          from.key,
          to.key,
          move.after,
        );
        if (moving.values.depth !== depth) d.setSkyMaterial(store.scene(), from.key, { depth });
        d.setSkyOrder(store.scene(), order);
      } else if (
        from.kind === 'part' &&
        to.kind === 'part' &&
        pathKey(from.path) === pathKey(to.path)
      ) {
        // A shape moved among its body's: its materials drawn where it is put.
        const b = store.bodyByKey().get(bodyKey(from.path));
        const order = b && movedShape(b, materialsOf(b), from.key, to.key, move.after);
        if (order) settings(from.path, (s) => ({ ...s, order }));
      } else if (
        from.kind === 'material' &&
        to.kind === 'material' &&
        pathKey(from.path) === pathKey(to.path)
      ) {
        const b = store.bodyByKey().get(bodyKey(from.path));
        if (!b) return;
        const order = movedInPart(b, materialsOf(b), from.key, to.key, move.after);
        if (order) settings(from.path, (s) => ({ ...s, order }));
      }
    },
    setMaterial(change: Partial<MaterialSettings>): void {
      materialChange(store.selected(), change);
    },
    clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
      const t = store.target();
      if (t.kind === 'sky-material') d.clearSkyMaterial(store.scene(), t.key, keys);
      else if (t.kind === 'material') settings(t.path, (s) => withoutMaterial(s, t.key, keys));
    },
  };
}
