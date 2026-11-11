import { bodyTintRows } from '../bodies/body';
import { bodyEdits } from '../editing/body-edits';
import { materialAt, materialsOf } from '../materials/materials';
import { type AdjustmentsOwner, adjustmentMethods } from '../tints/adjustments';
import { tintChanges } from '../tints/tint-rows';
import { bodyKey, SCENE, targetOf } from './scene-targets';
import { lightFirst } from '@myrddraall/heroes-replay-stats-aether/tints';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';

/**
 * The scene's colour adjustments, by the row they are under: its own grading (not a group's), a
 * body's (this scene's copy of it), one of its materials', the sky's, or one of its materials' (see
 * `adjustmentMethods`).
 */
export function sceneAdjustmentMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, levelAt } = w;
  return adjustmentMethods((owner): AdjustmentsOwner | null => {
    const t = targetOf(owner);
    if (owner === SCENE)
      return store.groupOpen()
        ? null
        : {
            grading: true,
            rows: store.sceneGrading(),
            set: store.sceneGradingSet(),
            // (Those on the light kept first: they are graded first, whatever the order.)
            write: (set) =>
              d.setSceneGrading(
                store.scene(),
                set?.tints ? { ...set, tints: lightFirst(set.tints) } : set,
              ),
          };
    if (t.kind === 'sky')
      return {
        rows: store.skyTints(),
        set: store.skyTintsSet(),
        write: (set) => d.setSkyTints(store.scene(), set),
      };
    if (t.kind === 'sky-material') {
      const m = materialAt(store.skyMaterials(), t.key);
      return m
        ? {
            rows: m.tints,
            set: m.set,
            write: (set) => {
              const change = tintChanges(set);
              if (change.clear.length) d.clearSkyMaterial(store.scene(), t.key, change.clear);
              if (change.set) d.setSkyMaterial(store.scene(), t.key, change.set);
            },
          }
        : null;
    }
    if (t.kind === 'body' || t.kind === 'material') {
      const level = levelAt(t.path);
      const b = store.bodyByKey().get(bodyKey(t.path));
      if (!level || !b) return null;
      if (t.kind === 'body')
        return {
          rows: bodyTintRows(b),
          set: b.settings,
          write: (set) => bodyEdits.setTints(level, set),
        };
      const m = materialAt(materialsOf(b), t.key);
      return m
        ? {
            rows: m.tints,
            set: m.set,
            write: (set) => bodyEdits.setMaterialTints(level, t.key, set),
          }
        : null;
    }
    return null;
  });
}
