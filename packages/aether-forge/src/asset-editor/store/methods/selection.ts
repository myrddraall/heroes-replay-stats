import {
  PREVIEW_SCENE,
  skyOverlayOn,
  withLightSwitched,
  without,
  withoutPartSetting,
  withOverlaySwitched,
  withPartSetting,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { withLightChanged } from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState, signalMethod } from '@ngrx/signals';
import { materialAt } from '../../../editing/model/materials';
import { lightsOfBody } from '../../../editing/model/lights';
import { removePart } from '../../../editing/part-hosts';
import type { AssetTarget } from '../../../layout/open-target';
import {
  ASSET,
  ASSET_LIGHTS,
  STAGE,
  STAGE_STAND_IN,
  moonKey,
  moonPaths,
  targetOf,
} from '../../asset-targets';
import type { AssetMethodsStore } from '../../asset-editor.store';
import type { AssetWrites } from './asset-writes';

/** What is open, selected, shown, switched on or off, focused, deleted or reset, and the level edits go into. */
export function assetSelectionMethods(store: AssetMethodsStore, w: AssetWrites) {
  const {
    asset,
    d,
    materialChange,
    materialClear,
    materialBelow,
    body,
    standInLightChange,
    moonSettings,
    removeMoonAt,
    lightChange,
  } = w;
  return {
    /** The asset the URL opens: its own row selected; a planet opened goes on the stage. */
    showAsset: signalMethod<AssetTarget>((a) => {
      const now = store.asset();
      if (
        a.kind === now.kind &&
        a.id === now.id &&
        a.on?.kind === now.on?.kind &&
        a.on?.id === now.on?.id
      )
        return;
      patchState(store, {
        asset: a,
        selected: ASSET,
        onStandIn: false,
        editorCamera: null,
        ...(a.kind === 'planet' ? { previewPlanet: a.id } : {}),
      });
      store._ui.confirmReset(false);
      store.expand(ASSET);
    }),
    /** A material opened from a planet or overlay: shown on the stand-in, or on that again. */
    showOnStandIn(onStandIn: boolean): void {
      patchState(store, { onStandIn });
    },
    /** The asset on the stage clicked: its own row selected (a planet's moon: its row). */
    selectPlaced(index: number): boolean {
      if (store.asset().kind === 'sky') return false;
      const path = index > 0 ? moonPaths(store._moons())[index - 1] : undefined;
      patchState(store, { selected: path ? moonKey(path) : ASSET });
      if (path) store.expand(ASSET);
      return true;
    },
    /** A row selected; a group only folds. */
    select(key: string): void {
      if (targetOf(key, asset()).kind === 'group') store.toggleExpanded(key);
      else patchState(store, { selected: key });
    },
    /** A part made here selected in the tree. */
    showAdded(key: string): void {
      store.expand(ASSET);
      patchState(store, { selected: key });
    },
    /** A part made here taken out (by the id its row's key ends with); a planet's own moon too. */
    removeAdded(key: string): void {
      const t = targetOf(key, asset());
      if (t.kind === 'moon') {
        removeMoonAt(t.path);
        return;
      }
      const host = store._addHost();
      if (host) removePart(host, key.slice(key.lastIndexOf(':') + 1));
    },
    /** A light's marker clicked: that light selected, its rows unfolded to it. */
    showMarker(key: string): void {
      if (key.startsWith(STAGE_STAND_IN)) store.expand(STAGE, STAGE_STAND_IN);
      else store.expand(ASSET, ASSET_LIGHTS);
      patchState(store, { selected: key });
    },
    setEnabled(change: { key: string; enabled: boolean }): void {
      const t = targetOf(change.key, asset());
      const on = change.enabled;
      const kind = body();
      if (t.kind === 'stand-in-light') standInLightChange(t.id, { enabled: on });
      // One of the planet's own moons: on is as it starts, so not kept.
      else if (t.kind === 'moon')
        moonSettings(t.path, (m) => (on ? without(m, ['enabled']) : { ...m, enabled: false }));
      // A sky's overlay, or one of its parts (the stage's sky's, or the library's).
      else if (t.kind === 'group' && t.skyOverlay) {
        const below = t.stage ? skyOverlayOn(undefined, d.library(), t.skyOverlay) : true;
        d.setSkyOverlayEnabled(t.stage ? PREVIEW_SCENE : null, t.skyOverlay, on, below);
      } else if (t.kind === 'sky-part') {
        const scope = t.stage ? PREVIEW_SCENE : null;
        const below = store._skyParts(t.stage).find((p) => p.key === t.key)?.enabledBelow ?? true;
        if (on === below) d.clearSkyPart(scope, t.key, ['enabled']);
        else d.setSkyPart(scope, t.key, { enabled: on });
      }
      // Each back to what is under it where that is the same, else set here.
      else if (t.kind === 'light') {
        const b = store._body();
        const below = (b && lightsOfBody(b).find((l) => l.light.id === t.id)?.enabledBelow) ?? true;
        lightChange((s) => withLightSwitched(s, t.id, on, below) ?? {});
      } else if (t.kind === 'part' && kind) {
        const now = d.library()[kind][asset().id] ?? {};
        const next = on
          ? withoutPartSetting(now, t.key, ['enabled'])
          : withPartSetting(now, t.key, { enabled: false });
        if (next?.parts) d.setLibraryBody(kind, asset().id, { parts: next.parts });
        else d.clearLibraryBody(kind, asset().id, ['parts']);
      } else if (t.kind === 'group' && t.overlay && kind) {
        const now = d.library()[kind][asset().id] ?? {};
        const next = withOverlaySwitched(now, t.overlay, on, true);
        if (next?.overlaysEnabled)
          d.setLibraryBody(kind, asset().id, { overlaysEnabled: next.overlaysEnabled });
        else d.clearLibraryBody(kind, asset().id, ['overlaysEnabled']);
        if (now.overlayEnabled !== undefined)
          d.clearLibraryBody(kind, asset().id, ['overlayEnabled']);
      } else if ('view' in t && t.view?.kind === 'gridLight') {
        // One of a shield's lights switched: the shield's lights set here.
        const m =
          t.kind === 'base-material'
            ? store.baseMaterial()
            : t.kind === 'material'
              ? materialAt(store._ownMaterials(), t.key)
              : undefined;
        const lights = m?.values.gridLights ?? [];
        materialChange(change.key, {
          gridLights: withLightChanged(lights, t.view.id, { enabled: on }),
        });
      } else if (on === materialBelow(t)) materialClear(t, ['enabled']);
      else materialChange(change.key, { enabled: on });
    },
    toggleFocus(): void {
      // a scene's: an asset's moons are shown about it as they are
    },
    setLayer(value: string): void {
      patchState(store, { variantEdited: value || null });
    },
    showLayer(name: string): void {
      const v = store
        ._variants()
        .find(
          (x) => name === `the ${x.name} variant` || name === `the ${x.name} variant (its data)`,
        );
      if (v) patchState(store, { variantEdited: v.id });
      else if (name === 'the library (planet)') patchState(store, { variantEdited: null });
    },
    /** The overlay open (made in the editor) deleted, and off whatever wore it: the library shown. */
    deleteAsset(): void {
      if (!store._created()) return;
      d.deleteOverlay(asset().id);
      store._ui.show({ kind: 'planet', id: store.previewPlanet() });
    },
    /** The asset open back as the game data has it (the stage keeps its sky). */
    resetAll(): void {
      const a = asset();
      const kind = body();
      if (kind) d.resetLibraryBody(kind, a.id);
      else if (a.kind === 'material') d.clearLibraryBaseMaterial(a.id);
      else if (a.kind === 'sky') d.resetLibrarySky();
      else {
        const material = store._catalog.particles().find((p) => p.id === a.id)?.material;
        if (material) d.clearLibrarySkyMaterial(material);
      }
      store._ui.confirmReset(false);
    },
    anotherSet(): void {
      // a scene's: an asset has no random sets
    },
  };
}
