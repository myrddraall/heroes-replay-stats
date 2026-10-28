import { overlayName } from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  type MaterialTint,
  NO_MATERIAL_TINT,
} from '@myrddraall/heroes-replay-stats-aether/materials';
import { computed } from '@angular/core';
import { baseMaterialOf, materialAt, type MaterialEntry } from '../materials/materials';
import {
  BodyCategory,
  bodyLabel,
  bodyView,
  CATEGORY_TITLES,
  type TargetKind,
} from '../bodies/body';
import { skyAnchorView } from '../sky/sky';
import { type MaterialView, viewTitle } from '../materials/material-views';
import { lightsOfBody } from '../lights/lights';
import type { PickChoice } from '../controls/pick-list';
import { type AssetTarget, openKey, type OpenTarget } from '../layout/open-target';
import { standInLights } from '../aids/stand-in';
import {
  ASSET,
  DEFAULT_PREVIEW_PLANET,
  ASSET_LIGHTS,
  atBody,
  KIND_TITLES,
  moonKey,
  moonPaths,
  STAGE,
  STAGE_STAND_IN,
  targetOf,
} from './asset-targets';
import type { AssetMethodsStore, WithOwn } from './asset-editor.store';
import { skyOverlayOn } from '@myrddraall/heroes-replay-stats-aether/library';
import { PREVIEW_SCENE, without } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { withLightChanged } from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState, signalMethod } from '@ngrx/signals';
import { removePart } from '../parts/part-hosts';
import type { AssetWrites } from './asset-writes';
import { overlayViewOf } from '../overlays/overlays';
import { bodyEdits } from '../editing/body-edits';
import type { Crumb } from '../tree/breadcrumb';
import { previewDefault, type PreviewSetup } from '../aids/preview-setup';

/** What is selected in the tree: its target, the body, material or sky it is, how the panel heads it, and what can be done with it. */
export function assetSelectionViews(store: WithOwn) {
  const {
    selected,
    asset,
    _skyOf,
    _draft,
    _catalog,
    _created,
    _skyOverlay,
    _body,
    _ownMaterials,
    _moonInfos,
    _materialUse,
    _skyMaterials,
    _skyParts,
    _aids,
    _ownParts,
  } = store;
  const library = _draft.library;
  const target = computed(() => targetOf(selected(), asset()));
  const selectedSky = computed(() => {
    const t = target();
    // The backdrop, where it is the sky, is the stage's sky.
    if (t.kind === 'backdrop') return _skyOf(true);
    return t.kind === 'sky' || t.kind === 'sky-material' ? _skyOf(t.stage) : null;
  });
  return {
    crumbs: computed((): readonly Crumb[] => []),
    overlayView: computed(() => {
      const t = target();
      return t.kind === 'overlay' ? overlayViewOf(_body(), t.id) : null;
    }),
    selectedVariant: computed(() => {
      const t = target();
      return t.kind === 'variant' ? t.id : null;
    }),
    target,
    opened: computed((): OpenTarget => asset()),
    heading: computed(() => {
      const a = asset();
      if (a.on) {
        const on =
          a.on.kind === 'planet'
            ? (library().planets[a.on.id]?.label ?? a.on.id)
            : overlayName(library(), a.on.id);
        const material = _catalog.materialByName().get(a.id)?.label ?? a.id;
        return `${on} › ${material}`;
      }
      // One made in the editor by its name (its id says nothing).
      const named =
        a.kind === 'sky'
          ? 'Play screen'
          : _created() || _skyOverlay()
            ? (library().styles[a.id]?.label ?? _skyOverlay()?.name ?? overlayName(library(), a.id))
            : a.id;
      return `${KIND_TITLES[a.kind]} · ${named}`;
    }),
    sharedMaterial: computed((): AssetTarget | null => {
      const t = target();
      const a = asset();
      const b = _body();
      if (t.kind !== 'material' || !b || (a.kind !== 'planet' && a.kind !== 'style')) return null;
      const m = materialAt(_ownMaterials(), t.key);
      if (!m) return null;
      return {
        kind: 'material',
        id: t.name,
        on: m.overlay ? { kind: 'style', id: m.overlay } : { kind: a.kind, id: a.id },
      };
    }),
    /** What the asset open was opened from (a material's planet or overlay): its way back. */
    parent: computed((): { target: OpenTarget; label: string } | null => {
      const on = asset().on;
      if (!on) return null;
      const label =
        on.kind === 'planet'
          ? (library().planets[on.id]?.label ?? on.id)
          : overlayName(library(), on.id);
      return { target: { kind: on.kind, id: on.id }, label };
    }),
    deletable: computed(() => _created() !== undefined),
    skyOverlayOpen: computed(() => _skyOverlay() !== null),
    resetAllLabel: computed(() => {
      const a = asset();
      return `Reset ${a.kind === 'sky' ? 'the sky' : a.id}`;
    }),
    kind: computed((): TargetKind => {
      const t = target();
      if ('view' in t && t.view) return t.view.kind;
      const k = t.kind;
      if (k === 'sky-part') return 'part';
      if (k === 'moon') return 'body';
      return k === 'base-material' ? 'material' : k === 'stand-in-light' ? 'light' : k;
    }),
    materialView: computed((): MaterialView | null => {
      const t = target();
      return 'view' in t && t.view ? t.view : null;
    }),
    bodyView: computed(() => {
      const t = target();
      // One of the planet's own moons: its orbit and what it wears here; its look is its own
      // planet's (its lights too), no moons of its own.
      if (t.kind === 'moon') {
        const m = _moonInfos().get(moonKey(t.path));
        return m ? bodyView(m, false, false, true) : null;
      }
      const b = _body();
      // A planet can have moons of its own; an overlay none.
      return atBody(t) && b ? bodyView(b, false, asset().kind === 'planet') : null;
    }),
    baseMaterial: computed((): MaterialEntry | undefined => {
      const use = _materialUse();
      return use
        ? baseMaterialOf(
            asset().id,
            use.material,
            use.textures,
            use.pattern,
            use.tuning,
            library().materials,
            use.particles,
            use.role,
            use.depth,
          )
        : undefined;
    }),
    title: computed(() => {
      const t = target();
      const a = asset();
      if ('view' in t && t.view) {
        const b = _body();
        const m =
          t.kind === 'sky-material'
            ? materialAt(_skyMaterials(t.stage), t.key)
            : t.kind === 'material'
              ? b && materialAt(_ownMaterials(), t.key)
              : undefined;
        return viewTitle(t.view, m ?? undefined);
      }
      if (t.kind === 'sky') return t.stage ? 'Stage sky' : 'Sky';
      if (t.kind === 'sky-part')
        return _skyParts(t.stage).find((p) => p.key === t.key)?.label ?? 'Part';
      if (t.kind === 'backdrop') return 'Backdrop';
      // (An overlay shown worn by a planet of the library: that planet, as its row says.)
      if (t.kind === 'stand-in')
        return (
          (asset().kind === 'style' &&
            _aids.previewOf(openKey(asset()), 'style', previewDefault('style')).planet) ||
          'Stand-in planet'
        );
      if (t.kind === 'stand-in-light')
        return (
          standInLights(_aids.standInLights()).find((x) => x.light.id === t.id)?.light.name ??
          'Properties'
        );
      if (t.kind === 'reference') return 'Reference';
      if (t.kind === 'overlay') return overlayViewOf(_body(), t.id)?.name ?? 'Overlay';
      if (atBody(t) && t.kind !== 'body') return CATEGORY_TITLES[t.kind as BodyCategory];
      if (t.kind === 'variant')
        return store.variantRows().find((v) => v.id === t.id)?.name ?? 'Variant';
      if (t.kind === 'sky-material')
        return materialAt(_skyMaterials(t.stage), t.key)?.label ?? t.name;
      if (t.kind === 'material') {
        const b = _body();
        return (b && materialAt(_ownMaterials(), t.key)?.label) ?? t.name;
      }
      if (t.kind === 'light') {
        const b = _body();
        return (b && lightsOfBody(b).find((x) => x.light.id === t.id)?.light.name) ?? 'Properties';
      }
      if (t.kind === 'part') {
        const p = _ownParts().find((x) => x.key === t.key);
        return p ? (p.overlayName ? `${p.label} · ${p.overlayName}` : p.label) : 'Part';
      }
      if (t.kind === 'base-material') return _catalog.materialByName().get(a.id)?.label ?? a.id;
      if (t.kind === 'group') return 'Properties';
      const b = _body();
      return b ? bodyLabel(b) : a.id;
    }),
    skyTint: computed((): MaterialTint => {
      const sky = selectedSky();
      return sky?.edited.tint ?? sky?.below?.tint ?? NO_MATERIAL_TINT;
    }),
    skyTintSet: computed(() => selectedSky()?.edited.tint),
    skyAnchor: computed(() => {
      const sky = selectedSky();
      return skyAnchorView(sky?.below, sky?.edited);
    }),
    skyChanged: computed(() => {
      const sky = selectedSky();
      return !!sky && (!!sky.edited.materials || !!sky.edited.tint || !!sky.edited.anchor);
    }),
    overlayOptions: computed((): readonly PickChoice[] => []),
    sets: computed(() => false),
  };
}

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
    levelOf,
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
      });
      store._ui.confirmReset(false);
      store.expand(ASSET);
    }),
    /** A material opened from a planet or overlay: shown on the stand-in, or on that again. */
    showOnStandIn(onStandIn: boolean): void {
      patchState(store, { onStandIn });
    },
    /** The asset on the stage clicked: its own row selected (a planet's moon: its row). */
    pickKey(index: number): string | null {
      if (store.asset().kind === 'sky') return null;
      if (index === 0) return ASSET;
      const path = moonPaths(store._moons())[index - 1];
      return path ? moonKey(path) : null;
    },
    selectPlaced(index: number): boolean {
      if (store.asset().kind === 'sky') return false;
      const path = index > 0 ? moonPaths(store._moons())[index - 1] : undefined;
      patchState(store, { selected: path ? moonKey(path) : ASSET });
      if (path) store.expand(ASSET);
      return true;
    },
    // (Editing in place is the scene editor's: the asset editor is always at what is open.)
    enter: () => undefined,
    leave: () => undefined,
    goTo: () => undefined,
    deselect(): void {
      patchState(store, { selected: ASSET });
    },
    setPreview(change: Partial<PreviewSetup>): void {
      store._aids.setPreview(store._previewKey(), change);
    },
    clearPreview(keys?: readonly (keyof PreviewSetup)[]): void {
      store._aids.clearPreview(store._previewKey(), keys);
    },
    usePreviewForKind(): void {
      store._aids.usePreviewForKind(store._previewKey(), store.asset().kind);
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
      if (t.kind === 'light') {
        const level = levelOf(t);
        if (level) bodyEdits.removeLight(level, t.id);
        if (store.selected() === key) patchState(store, { selected: ASSET });
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
      const level = levelOf(t);
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
      else if (t.kind === 'light' && level) bodyEdits.switchLight(level, t.id, on);
      else if (t.kind === 'part' && level) bodyEdits.switchPart(level, t.key, on);
      else if (t.kind === 'variant') w.variantOn(t.id, on);
      else if (t.kind === 'overlay' && level) bodyEdits.switchOverlay(level, t.id, on);
      else if (t.kind === 'material' && t.view?.kind === 'gridLight' && level)
        bodyEdits.switchShieldLight(level, t.key, t.view.id, on);
      else if (t.kind === 'material' && level) bodyEdits.switchMaterial(level, t.key, on);
      else if ('view' in t && t.view?.kind === 'gridLight') {
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
      store._ui.show({ kind: 'planet', id: DEFAULT_PREVIEW_PLANET });
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
