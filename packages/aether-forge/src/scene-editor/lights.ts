import {
  type LightId,
  type LightSettings,
  newLight,
  type LightKind,
  sourceIdOf,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import {
  SCENE,
  SCENE_LIGHTS,
  bodyKey,
  lightRowKey,
  lightsKey,
  placementKey,
  receiverOf,
  sceneLightKey,
} from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';
import { bodyEdits } from '../editing/body-edits';
import { litByOf } from '../lights/lights';
import type { LinkChange } from '../lights/linking';
import { groupLightSwitched, linkedLight } from './linking';
import { pathOf, siblingKey } from '@myrddraall/heroes-replay-stats-aether/scenes';

/** The scene's lights and its bodies', and what lights each body. */
export function lightMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, selectedPath, lightChange, levelAt, changePlacement } = w;
  /** A group put in the scene, by its key as Linking has it (see `placementKey`), and its sibling key. */
  const placementAt = (key: string) => {
    const placements = store.placements();
    const at = placements.findIndex((p, i) => placementKey(siblingKey(p, i)) === key);
    const p = placements[at];
    return p ? { p, key: siblingKey(p, at) } : null;
  };
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
      // (One of a body's data's handed on to it: its own row, by its own id.)
      w.reveal(lightRowKey(light.owner ?? t.path, sourceIdOf(id)));
    },
    setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
      const t = store.target();
      const receiver = receiverOf(t);
      const light = store.litBy()?.find((l) => l.id === change.id);
      if (!light || receiver === undefined || !('path' in t)) return;
      const level = levelAt(t.path);
      if (level) bodyEdits.setLitBy(level, light, receiver, change.on);
    },
    /**
     * The light selected taken in or left out by something it lights: a body, or one of its parts
     * or materials, as the body's Lit by does it (at the body's level); a group put in the scene, by
     * the scene's say over its planets.
     */
    setLinking({ key, receiver, on }: LinkChange): void {
      const linked = linkedLight(store);
      if (!linked) return;
      const group = placementAt(key);
      if (group) {
        changePlacement(group.key, { lights: groupLightSwitched(group.p.lights, linked.id, on) });
        return;
      }
      const b = store.bodyByKey().get(key);
      const path = pathOf(key.slice(5));
      const level = b && levelAt(path);
      // (Its own body knows it by its own id.)
      const id = key === linked.from ? (store.target() as { id: LightId }).id : linked.id;
      const light = b && litByOf(b, receiver, store.outerLightsOf(path)).find((l) => l.id === id);
      if (level && light) bodyEdits.setLitBy(level, light, receiver, on);
    },
    resetLinking(key: string): void {
      const linked = linkedLight(store);
      if (!linked) return;
      const group = placementAt(key);
      if (group) {
        changePlacement(group.key, { lights: groupLightSwitched(group.p.lights, linked.id, true) });
        return;
      }
      const level = store.bodyByKey().has(key) && levelAt(pathOf(key.slice(5)));
      if (!level) return;
      // Its own body: what its light reaches of it; another: what that body says of it.
      if (key === linked.from)
        bodyEdits.clearLight(level, (store.target() as { id: LightId }).id, ['reach']);
      else bodyEdits.clearLight(level, linked.id, ['enabled', 'reach']);
    },
    addLight(kind: LightKind): void {
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
