import {
  withAddedLight,
  withLightChange,
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
  ASSET,
  ASSET_LIGHTS,
  assetLightKey,
  assetOverlayKey,
  assetOverlayLightsKey,
  receiverOf,
} from './asset-targets';
import type { AssetMethodsStore } from './asset-editor.store';
import type { AssetWrites } from './asset-writes';

/** The asset's lights, the stand-in's, and what lights the asset. */
export function assetLightMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { standInLightChange, lightChange } = w;
  return {
    setLight(change: Partial<LightSettings>): void {
      const t = store.target();
      if (t.kind === 'stand-in-light') standInLightChange(t.id, change);
      else if (t.kind === 'light') lightChange((s) => withLightChange(s, t.id, change));
    },
    addLight(kind: NewLightKind): void {
      const b = store._body();
      if (!b) return;
      const light = newLight(
        kind,
        lightsOfBody(b)
          .map((l) => l.light)
          .filter((l) => l.id.startsWith('added-')),
      );
      lightChange((s) => withAddedLight(s, light));
      store.expand(ASSET, ASSET_LIGHTS);
      patchState(store, { selected: assetLightKey(light.id) });
    },
    /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
    showLight(id: LightId): void {
      const light = store.litBy()?.find((l) => l.id === id);
      if (!light) return;
      store.expand(ASSET);
      if (light.overlay) {
        store.reopen(assetOverlayKey(light.overlay));
        store.expand(assetOverlayLightsKey(light.overlay));
      } else store.expand(ASSET_LIGHTS);
      patchState(store, { selected: assetLightKey(id) });
    },
    setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
      const b = store._body();
      const receiver = receiverOf(store.target());
      const light = store.litBy()?.find((l) => l.id === change.id);
      if (b && light && receiver !== undefined)
        lightChange((s) => withLitBy(s, b, light, receiver, change.on) ?? {});
    },
    removeLight(id?: LightId): void {
      if (id) {
        lightChange((s) => withoutAddedLight(s, id) ?? {});
        return;
      }
      const t = store.target();
      if (t.kind !== 'light') return;
      lightChange((s) => withoutAddedLight(s, t.id) ?? {});
      patchState(store, { selected: ASSET });
    },
    clearLight(keys?: readonly (keyof LightSettings)[]): void {
      const t = store.target();
      if (t.kind === 'stand-in-light') standInLightChange(t.id, {}, keys ?? 'all');
      else if (t.kind === 'light') lightChange((s) => withoutLightSetting(s, t.id, keys) ?? {});
    },
  };
}
