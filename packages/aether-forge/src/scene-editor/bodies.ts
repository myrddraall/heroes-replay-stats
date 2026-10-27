import { ownOverlays } from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  addMoonAt,
  type BodySettings,
  type Orbit,
  resetMoon,
  resetOverlays,
  setOrbit,
  setPlace,
  storedBodies,
  type Vec3,
  without,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { patchState } from '@ngrx/signals';
import type { PoleDrag } from '../viewport/scene-markers';
import { wornKeyOf } from '../bodies/body';
import { axisAids, axisFrame, poleAt, poleDragged } from '../viewport/markers';
import { SCENE, bodyKey, overlayKey } from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** A body: its settings, poles, orbit, place, moons and the overlays it wears. */
export function bodyMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, edit, selectedPath, settings, posed, wear, removeBody, dragging } = w;
  return {
    /** A pole of the selected body's axis dragged in the view: its Axis moved, the body kept as it is. */
    dragPole(drag: PoleDrag): void {
      const path = selectedPath();
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      const placed = store._placed();
      const view = store.camera();
      if (!path || !scene || !placed || !view) return;
      const key = bodyKey(path);
      const b = store.bodyByKey().get(key);
      const body = placed.planets[placed.picks.indexOf(key)];
      const line = b && body ? axisAids(b, body, scene.camera, view)[drag.axis] : undefined;
      if (!line || !body || drag.phase === 'end') {
        dragging.pole = null;
        return;
      }
      if (drag.phase === 'start' || !dragging.pole) {
        dragging.pole = poleAt(line, drag.north);
        return;
      }
      const frame = axisFrame(line.orientation, body, scene.camera, view);
      const { axis, at } = poleDragged(line, drag.north, view.eye, drag.ray, dragging.pole, frame);
      dragging.pole = at;
      settings(path, (s) => posed(path, { ...s, axis }, ['axis']));
    },
    setBody(change: Partial<BodySettings>): void {
      const path = selectedPath();
      if (path)
        settings(path, (s) =>
          posed(path, { ...s, ...change }, Object.keys(change) as (keyof BodySettings)[]),
        );
    },
    clearBody(keys: readonly (keyof BodySettings)[]): void {
      const path = selectedPath();
      if (path) settings(path, (s) => posed(path, without(s, keys) ?? {}, keys));
    },
    resetBody(): void {
      const path = selectedPath();
      if (!path) return;
      // One of its planet's own moons: back as the planet has it, orbit and overlays too.
      if (store.bodyByKey().get(bodyKey(path))?.inherited)
        edit((b) => resetMoon(b, path, d.library()));
      else settings(path, () => undefined);
    },
    setOrbit(change: Partial<Orbit>): void {
      const path = selectedPath();
      if (path && path.length > 1) edit((b) => setOrbit(b, path, change));
    },
    /** The selected planet moved or sized. */
    setPlace(change: { readonly position?: Vec3; readonly radius?: number }): void {
      const path = selectedPath();
      if (path?.length === 1) edit((b) => setPlace(b, path, change));
    },
    /** A moon added about the selected body: shown in the tree and selected. */
    addMoon(moon: string): void {
      const parent = selectedPath();
      // (None about one of its planet's own moons: they are the planet's.)
      if (!parent || !store.hasPlanets() || store.bodyByKey().get(bodyKey(parent))?.inherited)
        return;
      const { bodies, path } = addMoonAt(store.sceneBodies(), parent, moon);
      d.setSceneBodies(store.scene(), storedBodies(bodies, d.library()));
      store.expand(bodyKey(parent));
      patchState(store, { selected: bodyKey(path) });
    },
    /**
     * The selected body taken out (a planet with its moons, a moon with its own): its parent
     * selected (the scene, for a planet), the view off it.
     */
    removeMoon(): void {
      const path = selectedPath();
      // (One of its planet's own moons stays: switched off, not taken out.)
      if (path?.length && !store.bodyByKey().get(bodyKey(path))?.inherited) removeBody(path);
    },
    /** An overlay put on the selected body, over what it wears. */
    /** An overlay the selected body wears shown in the tree, its rows unfolded. */
    showOverlay(id: string): void {
      const path = selectedPath();
      if (!path) return;
      store.expand(SCENE, ...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
      store.reopen(overlayKey(path, id));
    },
    addOverlay(id: string): void {
      wear((worn) => (worn.includes(id) ? worn : [...worn, id]));
    },
    /** An overlay taken off the selected body. */
    removeOverlay(id: string): void {
      wear((worn) => worn.filter((w) => w !== id));
    },
    /** What the selected body wears back as its own (the library's choice for it, else its data's). */
    resetOverlays(): void {
      const path = selectedPath();
      const b = path && store.bodyByKey().get(bodyKey(path));
      const own = b && (d.library().planets[b.id]?.overlays ?? ownOverlays(b.file?.tuning?.style));
      if (path && b && own) edit((bodies) => resetOverlays(bodies, path, wornKeyOf(b), own));
    },
  };
}
