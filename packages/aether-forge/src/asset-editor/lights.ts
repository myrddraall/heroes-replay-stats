import {
  type LightId,
  type LightSettings,
  type NewLightKind,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import { ASSET, ASSET_LIGHTS, assetLightKey, receiverOf } from './asset-targets';
import type { AssetMethodsStore } from './asset-editor.store';
import type { AssetWrites } from './asset-writes';
import { bodyEdits } from '../editing/body-edits';

/** The asset's lights, the stand-in's, and what lights the asset. */
export function assetLightMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { standInLightChange, selectedLevel } = w;
  return {
    setLight(change: Partial<LightSettings>): void {
      const t = store.target();
      if (t.kind === 'stand-in-light') standInLightChange(t.id, change);
      else if (t.kind === 'light') {
        const level = selectedLevel();
        if (level) bodyEdits.setLight(level, t.id, change);
      }
    },
    addLight(kind: NewLightKind): void {
      const level = selectedLevel();
      if (!level) return;
      const light = bodyEdits.addLight(level, kind);
      store.expand(ASSET, ASSET_LIGHTS);
      patchState(store, { selected: assetLightKey(light.id) });
    },
    /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
    showLight(id: LightId): void {
      const light = store.litBy()?.find((l) => l.id === id);
      if (!light) return;
      store.expand(ASSET, ASSET_LIGHTS);
      patchState(store, { selected: assetLightKey(id) });
    },
    setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
      const level = selectedLevel();
      const receiver = receiverOf(store.target());
      const light = store.litBy()?.find((l) => l.id === change.id);
      if (level && light && receiver !== undefined)
        bodyEdits.setLitBy(level, light, receiver, change.on);
    },
    removeLight(id?: LightId): void {
      const level = selectedLevel();
      if (id) {
        if (level) bodyEdits.removeLight(level, id);
        return;
      }
      const t = store.target();
      if (t.kind !== 'light' || !level) return;
      bodyEdits.removeLight(level, t.id);
      patchState(store, { selected: ASSET });
    },
    clearLight(keys?: readonly (keyof LightSettings)[]): void {
      const t = store.target();
      if (t.kind === 'stand-in-light') standInLightChange(t.id, {}, keys ?? 'all');
      else if (t.kind === 'light') {
        const level = selectedLevel();
        if (level) bodyEdits.clearLight(level, t.id, keys);
      }
    },
  };
}
