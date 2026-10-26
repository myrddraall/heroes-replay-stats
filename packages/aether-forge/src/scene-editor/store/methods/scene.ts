import { addPlanet, ownScene, storedBodies } from '@myrddraall/heroes-replay-stats-aether/design';
import { patchState, signalMethod } from '@ngrx/signals';
import { RANDOM_SETS } from '../../../layout/open-target';
import { EDITOR_CAMERA, SCENE, bodyKey } from '../../scene-targets';
import type { SceneMethodsStore } from '../../scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** The scene itself: shown, renamed, deleted, its planets added, another set drawn, its tint, all of it reset. */
export function sceneMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d } = w;
  return {
    /** The scene shown, as the URL says ('': the random sets'); its first planet selected. */
    showScene: signalMethod<string>((id) => {
      if (id === store.scene()) return;
      // Seen through the editor's camera, where the scene's primary is.
      patchState(store, { scene: id, focus: null, look: EDITOR_CAMERA, editorCamera: null });
      // Its first planet selected, where it has one (else the scene itself).
      patchState(store, { selected: id && store.sceneBodies().length ? bodyKey([0]) : SCENE });
      store._ui.confirmReset(false);
      store.expand(SCENE, bodyKey([0]));
    }),
    rename(name: string): void {
      if (ownScene(store.scene())) d.renameScene(store.scene(), name);
    },
    /** The scene taken out of the draft; the library shown (the random sets behind it). */
    deleteScene(): void {
      if (!ownScene(store.scene())) return;
      d.deleteScene(store.scene());
      store._ui.show(RANDOM_SETS);
    },
    /** A planet, by id, put in the scene: shown in the tree and selected. */
    addPlanet(id: string): void {
      if (!store.hasPlanets()) return;
      const { bodies, path } = addPlanet(store.sceneBodies(), id);
      d.setSceneBodies(store.scene(), storedBodies(bodies, d.library()));
      store.expand(SCENE);
      patchState(store, { selected: bodyKey(path) });
    },
    anotherSet(): void {
      store._background.nextPlanetSet();
    },
    chooseTint(choice: string): void {
      d.chooseTint(choice);
    },
    setTint: d.setTint,
    /** The whole scene back as the library has it: its planets' looks, moons, sky, the colour; the view on it all. */
    resetAll(): void {
      d.resetScene(store.scene());
      d.resetTint();
      patchState(store, { focus: null, selected: SCENE });
      store._ui.confirmReset(false);
    },
  };
}
