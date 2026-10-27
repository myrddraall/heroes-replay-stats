import type { CreatedShape } from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  type BodySettings,
  PREVIEW_SCENE,
  without,
  withoutPartSetting,
  withPartSetting,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { PartSettings } from '@myrddraall/heroes-replay-stats-aether/formats';
import { patchState } from '@ngrx/signals';
import {
  addMaterial,
  addReused,
  addShape,
  removeMaterial,
  removePart,
  settingsAsOverlay,
} from '../parts/part-hosts';
import { ASSET, STAGE_SKY } from './asset-targets';
import type { AssetMethodsStore } from './asset-editor.store';
import type { AssetWrites } from './asset-writes';

/** The asset's parts: their settings, those added, their materials, saved as an overlay. */
export function assetPartMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { asset, d, selectAdded, body } = w;
  return {
    setPart(change: Partial<PartSettings>): void {
      const kind = body();
      const t = store.target();
      if (t.kind === 'sky-part') {
        d.setSkyPart(t.stage ? PREVIEW_SCENE : null, t.key, change);
        return;
      }
      if (!kind || t.kind !== 'part') return;
      const now = d.library()[kind][asset().id] ?? {};
      d.setLibraryBody(kind, asset().id, { parts: withPartSetting(now, t.key, change).parts });
    },
    clearPart(keys?: readonly (keyof PartSettings)[]): void {
      const kind = body();
      const t = store.target();
      if (t.kind === 'sky-part') {
        d.clearSkyPart(t.stage ? PREVIEW_SCENE : null, t.key, keys);
        return;
      }
      if (!kind || t.kind !== 'part') return;
      const left = withoutPartSetting(d.library()[kind][asset().id] ?? {}, t.key, keys)?.parts;
      if (left) d.setLibraryBody(kind, asset().id, { parts: left });
      else d.clearLibraryBody(kind, asset().id, ['parts']);
    },
    /** A new part of a shape added onto what is selected (the overlay or planet open, a sky): selected. */
    addPart(shape: CreatedShape): void {
      const host = store._addHost();
      if (host) selectAdded(addShape(host, shape));
    },
    /** One of the game data's parts added onto what is selected, reused: selected. */
    reusePart(value: string): void {
      const host = store._addHost();
      const reused = host && store._catalog.reusableParts()[host.kind][Number(value)];
      if (host && reused) selectAdded(addReused(host, reused));
    },
    /** The selected part taken out (one made at this level: what only it drew, with it). */
    removePart(): void {
      const at = store._partHost();
      const t = store.target();
      if (!at) return;
      removePart(at.host, at.id);
      patchState(store, {
        selected: t.kind === 'sky-part' ? (t.stage ? STAGE_SKY : ASSET) : ASSET,
      });
    },
    /**
     * A material drawn on the selected part too, over the rest: as the game data has it where it
     * is first used there (kept by where that is, not copied).
     */
    addPartMaterial(name: string): void {
      const at = store._partHost();
      const source = store._catalog.materialSource()(name);
      if (at && source) addMaterial(at.host, at.id, name, source);
    },
    /** A material no longer drawn on the selected part. */
    removePartMaterial(name: string): void {
      const at = store._partHost();
      if (at) removeMaterial(at.host, at.id, name);
    },
    /**
     * The parts added onto the planet or sky selected saved as a new overlay: a sky wears it in
     * their place (what was set for them kept as the overlay's); a planet keeps them (a library
     * planet wears what its data says), the overlay starting as they are set.
     */
    saveAsOverlay(): void {
      const host = store._addHost();
      const t = store.target();
      if (!host?.parts.length || store._created()) return;
      const parts = host.parts;
      const id = d.createOverlay(host.kind, parts);
      const kept = (s: BodySettings) => settingsAsOverlay({ ...s, addedParts: parts }, id, parts);
      if (t.kind === 'sky') {
        const scene = t.stage ? PREVIEW_SCENE : null;
        d.changeSky(scene, (sky) => settingsAsOverlay(sky, id, parts));
        d.setSkyOverlays(scene, [...store._skyOverlays(t.stage).map((o) => o.id), id]);
      } else {
        // The overlay's own settings start as the planet's for those parts.
        const own = kept(d.library().planets[asset().id] ?? {});
        const settings = without(own, ['label', 'enabled', 'lights', 'added', 'tint', 'rim']);
        if (settings) d.setLibraryBody('styles', id, settings);
      }
      store._ui.open({ kind: 'style', id });
    },
  };
}
