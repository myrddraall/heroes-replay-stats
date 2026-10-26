import { overlayName } from '@myrddraall/heroes-replay-stats-aether/design';
import { type MaterialTint } from '@myrddraall/heroes-replay-stats-aether/formats';
import { NO_MATERIAL_TINT } from '@myrddraall/heroes-replay-stats-aether/materials';
import { computed } from '@angular/core';
import { baseMaterialOf, materialAt, type MaterialEntry } from '../../editing/model/materials';
import { bodyLabel, bodyView, type TargetKind } from '../../editing/model/body';
import { skyAnchorView } from '../../editing/model/sky';
import { type MaterialView, viewTitle } from '../../editing/model/views';
import { lightsOfBody } from '../../editing/model/lights';
import type { PickChoice } from '../../controls/pick-list';
import type { AssetTarget, OpenTarget } from '../../layout/open-target';
import { standInLights } from '../../aids/stand-in';
import { KIND_TITLES, moonKey, targetOf } from '../asset-targets';
import type { WithOwn } from '../asset-editor.store';

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
      return t.kind === 'body' && b ? bodyView(b, false, asset().kind === 'planet') : null;
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
      if (t.kind === 'stand-in') return 'Stand-in planet';
      if (t.kind === 'stand-in-light')
        return (
          standInLights(_aids.standInLights()).find((x) => x.light.id === t.id)?.light.name ??
          'Properties'
        );
      if (t.kind === 'reference') return 'Reference';
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
