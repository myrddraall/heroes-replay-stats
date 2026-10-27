import {
  type BodyPath,
  changeMoon,
  type MoonChoices,
  pathKey,
  PREVIEW_SCENE,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { LightId, LightSettings } from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import { materialAt } from '../materials/materials';
import { keepingPose } from '../viewport/markers';
import { editingVariant } from '../variants/editing-variant';
import { withStandInLight } from '../aids/stand-in';
import {
  ASSET,
  type Target,
  assetPartKey,
  atBody,
  libraryKind,
  moonKey,
  skyRowKeys,
  targetOf,
} from './asset-targets';
import type { AssetMethodsStore } from './asset-editor.store';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';
import { variantsOnOf } from '@myrddraall/heroes-replay-stats-aether/variants';

/** What the asset editor's methods change the library through: the asset's settings (or the variant edited), its materials, moons and lights, and the stage's sky. */
export function assetWrites(store: AssetMethodsStore) {
  /** Where the pole being dragged is (see `dragPole`). */
  const dragging = { pole: null as Vec3 | null };
  const draft = store._draft;
  const asset = () => store.asset();
  const d = editingVariant(
    draft,
    () => (asset().kind === 'planet' ? asset().id : null),
    store.variantOpen,
  );
  const materialChange = (key: string, change: Partial<MaterialSettings>) => {
    const t = targetOf(key, asset());
    const kind = libraryKind(asset().kind);
    if (t.kind === 'sky-material') {
      if (t.stage) d.setSkyMaterial(PREVIEW_SCENE, t.key, change);
      else d.setLibrarySkyMaterial(t.key, change);
    } else if (t.kind === 'material' && kind) d.setLibraryMaterial(kind, asset().id, t.key, change);
    else if (t.kind === 'base-material') d.setLibraryBaseMaterial(asset().id, change);
  };
  /** Settings of a material put back as the levels under it have them (all: none named). */
  const materialClear = (t: Target, keys?: readonly (keyof MaterialSettings)[]) => {
    const kind = libraryKind(asset().kind);
    if (t.kind === 'sky-material') {
      if (t.stage) d.clearSkyMaterial(PREVIEW_SCENE, t.key, keys);
      else d.clearLibrarySkyMaterial(t.key, keys);
    } else if (t.kind === 'material' && kind) d.clearLibraryMaterial(kind, asset().id, t.key, keys);
    else if (t.kind === 'base-material') d.clearLibraryBaseMaterial(asset().id, keys);
  };
  /** Whether a material is drawn as the levels under the one edited have it. */
  const materialBelow = (t: Target): boolean => {
    if (t.kind === 'base-material') return store.baseMaterial()?.enabledBelow ?? true;
    if (t.kind === 'sky-material')
      return materialAt(store._skyMaterials(t.stage), t.key)?.enabledBelow ?? true;
    const b = store._body();
    const m = t.kind === 'material' && b && materialAt(store._ownMaterials(), t.key);
    return m ? m.enabledBelow : true;
  };
  /** A part just added onto what is selected selected, its row shown. */
  const selectAdded = (id: string) => {
    const t = store.target();
    if (t.kind === 'sky') {
      const keys = skyRowKeys(t.stage);
      if (!t.stage) store.expand(ASSET);
      patchState(store, { selected: keys.part(`own:${id}`) });
    } else {
      store.expand(ASSET);
      patchState(store, {
        selected: assetPartKey(store._created() ? `style:${asset().id}:${id}` : `own:${id}`),
      });
    }
  };
  const selectedSky = () => {
    const t = store.target();
    if (t.kind === 'backdrop') return { stage: true };
    return t.kind === 'sky' || t.kind === 'sky-material' ? t : null;
  };
  const body = () => libraryKind(asset().kind);
  /** The asset's settings after a change, kept where it is as its Axis moves (see `keepingPose`). */
  const posed = (next: BodySettings, touched: readonly (keyof BodySettings)[]) => {
    const b = store._body();
    return b ? keepingPose(b, next, touched) : next;
  };
  /** One of the stand-in's lights changed (an editing aid's: kept with the aids). */
  const standInLightChange = (
    id: LightId,
    change: Partial<LightSettings>,
    clear: readonly (keyof LightSettings)[] | 'all' = [],
  ) =>
    store._aids.set({
      standInLights: withStandInLight(store._aids.standInLights(), id, change, clear),
    });
  /** The planet open's own moons changed. */
  const changeMoons = (change: (moons: readonly MoonChoices[]) => readonly MoonChoices[]) => {
    const a = asset();
    if (a.kind === 'planet') d.setLibraryMoons(a.id, change(store._moons()));
  };
  /** One of them's settings changed (none left: none). */
  const moonSettings = (path: BodyPath, change: (s: BodySettings) => BodySettings | undefined) =>
    changeMoons((moons) =>
      changeMoon(moons, path, (m) => {
        const settings = change(m.settings ?? {});
        return {
          ...m,
          settings: settings && Object.keys(settings).length ? settings : undefined,
        };
      }),
    );
  /** What the selected moon wears changed (the later over the earlier), over its own. */
  /** What the planet open (its library's choice) or its moon selected wears changed. */
  const wears = (change: (worn: readonly string[]) => readonly string[]) => {
    const t = store.target();
    if (atBody(t) && asset().kind === 'planet') {
      const b = store._body();
      // (What it can wear is the planet's own, whatever is edited: a variant only switches it.)
      if (b)
        draft.setLibraryBody('planets', asset().id, {
          overlays: change(b.overlays.map((o) => o.id)),
        });
      return;
    }
    const m = t.kind === 'moon' ? store._moonInfos().get(moonKey(t.path)) : undefined;
    if (t.kind !== 'moon' || !m) return;
    const worn = change(m.overlays.map((o) => o.id));
    changeMoons((moons) => changeMoon(moons, t.path, (x) => ({ ...x, overlays: worn })));
  };
  /** One of them taken out (with its own): the planet selected where it was. */
  const removeMoonAt = (path: BodyPath) => {
    changeMoons((moons) => changeMoon(moons, path, () => null));
    const t = store.target();
    if (t.kind === 'moon' && pathKey(t.path).startsWith(pathKey(path)))
      patchState(store, { selected: ASSET });
  };
  /**
   * The library body's lights changed: what is left of them written back (none: taken back), and
   * its shadow as set before lights were objects taken back once it is its shadow light's.
   */
  const lightChange = (change: (s: BodySettings) => BodySettings) => {
    const kind = body();
    if (!kind) return;
    const now = d.library()[kind][asset().id] ?? {};
    const next = change(now);
    if (next.lights) d.setLibraryBody(kind, asset().id, { lights: next.lights });
    else d.clearLibraryBody(kind, asset().id, ['lights']);
    if (next.added) d.setLibraryBody(kind, asset().id, { added: next.added });
    else if (now.added) d.clearLibraryBody(kind, asset().id, ['added']);
    const gone = (['shade', 'shadeTowards'] as const).filter(
      (k) => now[k] !== undefined && next[k] === undefined,
    );
    if (gone.length) d.clearLibraryBody(kind, asset().id, gone);
  };
  /** One of the planet open's variants switched on or off by default (the last switched on over the others). */
  const variantOn = (id: string, on: boolean) => {
    const a = asset();
    if (a.kind !== 'planet') return;
    const now = variantsOnOf(draft.library().planets[a.id]);
    draft.setVariantsOn(
      a.id,
      on ? [...now.filter((v) => v !== id), id] : now.filter((v) => v !== id),
    );
  };
  return {
    draft,
    asset,
    d,
    variantOn,
    materialChange,
    materialClear,
    materialBelow,
    selectAdded,
    selectedSky,
    body,
    posed,
    standInLightChange,
    changeMoons,
    moonSettings,
    wears,
    removeMoonAt,
    lightChange,
    dragging,
  };
}

export type AssetWrites = ReturnType<typeof assetWrites>;
