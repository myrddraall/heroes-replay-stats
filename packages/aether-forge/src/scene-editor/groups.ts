import {
  canPutGroup,
  type GroupPlacement,
  SCENE_CENTRE,
  indexOfKey,
  newKey,
  PLACEMENT_KEY,
  siblingKey,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { patchState } from '@ngrx/signals';
import { SCENE, placementKey } from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';
import { parentRowOf } from '../tree/select-parent-when-gone';

/** Groups put in the scene. */
export function groupMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, changePlacement } = w;
  return {
    /** A group put in the scene, its middle where a first planet goes: selected. */
    addGroup(id: string): void {
      if (!store.hasPlanets() || !canPutGroup(id, store.scene(), (g) => d.scenes().planets[g]))
        return;
      const placements = store.placements();
      const key = newKey(PLACEMENT_KEY);
      d.setSceneGroups(store.scene(), [
        ...placements,
        { group: id, key, position: SCENE_CENTRE.position },
      ]);
      store.expand(SCENE);
      patchState(store, { selected: placementKey(key) });
    },
    /** The group put in the scene selected changed (where it is, how big, its name there). */
    setPlacement(change: Partial<GroupPlacement>): void {
      const t = store.target();
      if (t.kind === 'placement') changePlacement(t.key, change);
    },
    /** The group put in the scene selected taken out: the scene selected. */
    removePlacement(): void {
      const t = store.target();
      if (t.kind !== 'placement') return;
      const up = parentRowOf(store.rows(), store.selected());
      d.setSceneGroups(
        store.scene(),
        store.placements().filter((p, i) => siblingKey(p, i) !== t.key),
      );
      patchState(store, { selected: up ?? SCENE });
    },
    /** The group put in the scene selected opened (what is in it is set there). */
    editPlacedGroup(): void {
      const t = store.target();
      const p =
        t.kind === 'placement'
          ? store.placements()[indexOfKey(store.placements(), t.key)]
          : undefined;
      if (p) store._ui.open({ kind: 'group', id: p.group });
    },
  };
}
