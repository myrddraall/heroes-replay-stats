import {
  type LightId,
  type LightSettings,
  newLight,
  type NewLightKind,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import {
  SCENE,
  SCENE_LIGHTS,
  bodyKey,
  lightRowKey,
  lightsKey,
  receiverOf,
  sceneLightKey,
} from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';
import { bodyEdits } from '../editing/body-edits';

/** The scene's lights and its bodies', and what lights each body. */
export function lightMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, selectedPath, lightChange, levelAt } = w;
  return {
    setLight(change: Partial<LightSettings>): void {
      lightChange(store.target(), change);
    },
    /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
    showLight(id: LightId): void {
      const t = store.target();
      const light = store.litBy()?.find((l) => l.id === id);
      if (!light || !('path' in t)) return;
      if (light.owner === 'scene') {
        store.expand(SCENE);
        store.reopen(SCENE_LIGHTS);
        patchState(store, { selected: sceneLightKey(id) });
        return;
      }
      w.reveal(lightRowKey(light.owner ?? t.path, id));
    },
    setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
      const t = store.target();
      const receiver = receiverOf(t);
      const light = store.litBy()?.find((l) => l.id === change.id);
      if (!light || receiver === undefined || !('path' in t)) return;
      const level = levelAt(t.path);
      if (level) bodyEdits.setLitBy(level, light, receiver, change.on);
    },
    addLight(kind: NewLightKind): void {
      const t = store.target();
      const path = selectedPath();
      const level = path && levelAt(path);
      if (path && level && t.kind !== 'scene-light') {
        const light = bodyEdits.addLight(level, kind);
        store.expand(bodyKey(path), lightsKey(path));
        patchState(store, { selected: lightRowKey(path, light.id) });
      } else {
        const light = newLight(kind, store.sceneLights());
        d.setSceneLights(store.scene(), [...store.sceneLights(), light]);
        patchState(store, { selected: sceneLightKey(light.id) });
      }
    },
    removeLight(id?: LightId): void {
      const t = store.target();
      const path = selectedPath();
      if (id) {
        const level = path && levelAt(path);
        if (level) bodyEdits.removeLight(level, id);
        return;
      }
      if (t.kind === 'scene-light') {
        d.setSceneLights(
          store.scene(),
          store.sceneLights().filter((l) => l.id !== t.id),
        );
        patchState(store, { selected: SCENE });
      } else if (t.kind === 'light') {
        const level = levelAt(t.path);
        if (level) bodyEdits.removeLight(level, t.id);
        patchState(store, { selected: bodyKey(t.path) });
      }
    },
    clearLight(keys?: readonly (keyof LightSettings)[]): void {
      const t = store.target();
      const level = t.kind === 'light' && levelAt(t.path);
      if (t.kind === 'light' && level) bodyEdits.clearLight(level, t.id, keys);
    },
  };
}
