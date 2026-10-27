import {
  canPutGroup,
  type GroupPlacement,
  SCENE_CENTRE,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { patchState } from '@ngrx/signals';
import { SCENE, placementKey } from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** Groups put in the scene. */
export function groupMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, changePlacement } = w;
  return {
    /** A group put in the scene, its middle where a first planet goes: selected. */
    addGroup(id: string): void {
      if (!store.hasPlanets() || !canPutGroup(id, store.scene(), (g) => d.scenes().planets[g]))
        return;
      const placements = store.placements();
      d.setSceneGroups(store.scene(), [
        ...placements,
        { group: id, position: SCENE_CENTRE.position },
      ]);
      store.expand(SCENE);
      patchState(store, { selected: placementKey(placements.length) });
    },
    /** The group put in the scene selected changed (where it is, how big, its name there). */
    setPlacement(change: Partial<GroupPlacement>): void {
      const t = store.target();
      if (t.kind === 'placement') changePlacement(t.index, change);
    },
    /** The group put in the scene selected taken out: the scene selected. */
    removePlacement(): void {
      const t = store.target();
      if (t.kind !== 'placement') return;
      d.setSceneGroups(
        store.scene(),
        store.placements().filter((_, i) => i !== t.index),
      );
      patchState(store, { selected: SCENE });
    },
    /** The group put in the scene selected opened (what is in it is set there). */
    editPlacedGroup(): void {
      const t = store.target();
      const p = t.kind === 'placement' ? store.placements()[t.index] : undefined;
      if (p) store._ui.open({ kind: 'group', id: p.group });
    },
  };
}
