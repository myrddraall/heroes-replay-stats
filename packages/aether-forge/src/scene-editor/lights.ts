import {
  withAddedLight,
  withoutAddedLight,
  withoutLightSetting,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import {
  type LightId,
  type LightSettings,
  newLight,
  type NewLightKind,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import { lightsOfBody, withLitBy } from '../lights/lights';
import {
  SCENE,
  SCENE_LIGHTS,
  bodyKey,
  lightRowKey,
  lightsKey,
  overlayKey,
  overlayLightsKey,
  receiverOf,
  sceneLightKey,
} from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** The scene's lights and its bodies', and what lights each body. */
export function lightMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, selectedPath, settings, lightChange } = w;
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
      const path = light.owner ?? t.path;
      store.expand(SCENE, ...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
      if (light.overlay) {
        store.reopen(overlayKey(path, light.overlay));
        store.expand(overlayLightsKey(path, light.overlay));
      } else store.expand(lightsKey(path));
      patchState(store, { selected: lightRowKey(path, id) });
    },
    setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
      const t = store.target();
      const receiver = receiverOf(t);
      const light = store.litBy()?.find((l) => l.id === change.id);
      if (!light || receiver === undefined || !('path' in t)) return;
      const b = store.bodyByKey().get(bodyKey(t.path));
      if (!b) return;
      settings(t.path, (s) => withLitBy(s, b, light, receiver, change.on));
    },
    addLight(kind: NewLightKind): void {
      const t = store.target();
      const path = selectedPath();
      if (path && t.kind !== 'scene-light') {
        const b = store.bodyByKey().get(bodyKey(path));
        const light = newLight(
          kind,
          b
            ? lightsOfBody(b)
                .map((l) => l.light)
                .filter((l) => l.id.startsWith('added-'))
            : [],
        );
        settings(path, (s) => withAddedLight(s, light));
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
        if (path) settings(path, (s) => withoutAddedLight(s, id));
        return;
      }
      if (t.kind === 'scene-light') {
        d.setSceneLights(
          store.scene(),
          store.sceneLights().filter((l) => l.id !== t.id),
        );
        patchState(store, { selected: SCENE });
      } else if (t.kind === 'light') {
        settings(t.path, (s) => withoutAddedLight(s, t.id));
        patchState(store, { selected: bodyKey(t.path) });
      }
    },
    clearLight(keys?: readonly (keyof LightSettings)[]): void {
      const t = store.target();
      if (t.kind === 'light') settings(t.path, (s) => withoutLightSetting(s, t.id, keys));
    },
  };
}
