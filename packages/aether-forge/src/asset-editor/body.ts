import {
  overlayFileFor,
  ownOverlays,
  withAddedParts,
} from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  addMoon as addMoonTo,
  changeMoon,
  DEFAULT_ORBIT,
  moonAt,
  type MoonChoices,
  type Orbit,
  without,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { computed } from '@angular/core';
import type { BodyInfo } from '../bodies/body';
import { ASSET, libraryKind, moonKey, moonPaths, nextMoonKey } from './asset-targets';
import type { AssetMethodsStore, WithStageSky } from './asset-editor.store';
import { patchState } from '@ngrx/signals';
import { axisAids, axisFrame, poleAt, poleDragged } from '../viewport/markers';
import type { PoleDrag } from '../viewport/scene-markers';
import type { AssetWrites } from './asset-writes';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';

/** The body open (a planet, or an overlay on the stand-in), its levels, and its moons. */
export function assetBodyViews(store: WithStageSky) {
  const { asset, _draft, _catalog, _skyOverlay: skyOverlay, _planetLevels: planetLevels } = store;
  const library = _draft.library;
  /** The planet open's own moons (the library's; none for anything else). */
  const moons = computed((): readonly MoonChoices[] => {
    const a = asset();
    return a.kind === 'planet' ? (library().moons?.[a.id] ?? []) : [];
  });
  return {
    /**
     * The planet or style open, as the editor has it: its defaults over its file's tuning; a
     * planet in the style it wears of its own, whose settings it sets as it wears it.
     */
    _body: computed((): BodyInfo | null => {
      const a = asset();
      const kind = libraryKind(a.kind);
      if (!kind) return null;
      const files = _catalog.files();
      // A sky's overlay open: a body with no parts of its own (its parts are the sky's).
      const file = skyOverlay()
        ? { kind: 'style' as const, parts: [], materials: {}, textures: {} }
        : a.kind === 'planet'
          ? files[a.id] &&
            withAddedParts(files[a.id], library().planets[a.id]?.addedParts, _catalog.madeLookup())
          : files[overlayFileFor(library(), a.id)];
      // A planet wears what it chooses for itself, else what its data says; an overlay, none.
      const chosen = a.kind === 'planet' ? library().planets[a.id]?.overlays : undefined;
      const worn = a.kind === 'planet' ? (chosen ?? ownOverlays(file?.tuning?.style)) : [];
      const name = (id: string) => library().created?.[id]?.label;
      const made = name(a.id) ?? skyOverlay()?.name;
      return {
        key: ASSET,
        id: a.id,
        ...(made ? { name: made } : {}),
        overlays: worn.map((id) => ({
          id,
          ...(name(id) ? { name: name(id) } : {}),
          below: library().styles[id],
          file: files[overlayFileFor(library(), id)],
        })),
        overlaysSet: chosen !== undefined,
        ...(a.kind === 'planet' ? planetLevels(a.id) : { settings: library()[kind][a.id] ?? {} }),
        materialBase: library().materials,
        file,
        moons: [],
      };
    }),
    /** The planet open's own moons (the library's; none for anything else). */
    _moons: moons,
    /** Those moons as the editor has them (theirs after each), by `moonKey`. */
    _moonInfos: computed((): ReadonlyMap<string, BodyInfo> => {
      const files = _catalog.files();
      const lib = library();
      const list = moons();
      const out = new Map<string, BodyInfo>();
      for (const path of moonPaths(list)) {
        const m = moonAt(list, path)!;
        const file = files[m.id];
        const worn = m.overlays ?? lib.planets[m.id]?.overlays ?? ownOverlays(file?.tuning?.style);
        out.set(moonKey(path), {
          key: moonKey(path),
          id: m.id,
          overlays: worn.map((id) => ({
            id,
            ...(lib.created?.[id] ? { name: lib.created[id].label } : {}),
            below: lib.styles[id],
            file: files[overlayFileFor(lib, id)],
          })),
          overlaysSet: m.overlays !== undefined,
          settings: m.settings ?? {},
          below: lib.planets[m.id],
          materialBase: lib.materials,
          file: file && withAddedParts(file, lib.planets[m.id]?.addedParts, _catalog.madeLookup()),
          orbit: m.orbit,
          moons: m.moons ?? [],
        });
      }
      return out;
    }),
  };
}

/** The body open: its settings, poles, moons and the overlays it wears. */
export function assetBodyMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { draft, asset, d, body, posed, changeMoons, moonSettings, wears, removeMoonAt, dragging } =
    w;
  return {
    /** A pole of the planet open's axis dragged in the view: its Axis moved, the planet kept as it is. */
    dragPole(drag: PoleDrag): void {
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      const b = store._body();
      const body = store.stagePlanets()[0];
      const view = store.camera();
      const kind = body && scene && view && b ? libraryKind(asset().kind) : null;
      const line =
        kind && b && body && scene && view
          ? axisAids(b, body, scene.camera, view)[drag.axis]
          : undefined;
      if (!line || !kind || !body || !scene || !view || drag.phase === 'end') {
        dragging.pole = null;
        return;
      }
      if (drag.phase === 'start' || !dragging.pole) {
        dragging.pole = poleAt(line, drag.north);
        return;
      }
      const frame = axisFrame(line.orientation, body, scene.camera, view);
      const { axis, at } = poleDragged(line, drag.north, view.eye, drag.ray, dragging.pole, frame);
      dragging.pole = at;
      d.changeLibraryBody(kind, asset().id, (s) => posed({ ...s, axis }, ['axis']));
    },
    setBody(change: Partial<BodySettings>): void {
      const t = store.target();
      if (t.kind === 'moon') {
        moonSettings(t.path, (m) => ({ ...m, ...change }));
        return;
      }
      const kind = body();
      // Its Axis moved: its base turn with it, so it stays as it is (see `keepingPose`).
      if (kind)
        d.changeLibraryBody(kind, asset().id, (s) =>
          posed({ ...s, ...change }, Object.keys(change) as (keyof BodySettings)[]),
        );
    },
    clearBody(keys: readonly (keyof BodySettings)[]): void {
      const t = store.target();
      if (t.kind === 'moon') {
        moonSettings(t.path, (m) => without(m, keys));
        return;
      }
      const kind = body();
      if (kind) d.changeLibraryBody(kind, asset().id, (s) => posed(without(s, keys) ?? {}, keys));
    },
    resetBody(): void {
      const t = store.target();
      if (t.kind === 'moon') {
        // Back as a new moon: its orbit, its own overlays, nothing set.
        changeMoons((moons) =>
          changeMoon(moons, t.path, (m) => ({ id: m.id, key: m.key, orbit: DEFAULT_ORBIT })),
        );
        return;
      }
      const kind = body();
      if (kind) d.resetLibraryBody(kind, asset().id);
    },
    setPlace(): void {
      // a scene's planet's: an asset has no place
    },
    /** The selected moon's orbit changed. */
    setOrbit(change: Partial<Orbit>): void {
      const t = store.target();
      if (t.kind === 'moon')
        changeMoons((moons) =>
          changeMoon(moons, t.path, (m) => ({ ...m, orbit: { ...m.orbit, ...change } })),
        );
    },
    /** A moon, by its planet's id, put about the planet open (none about a moon): shown and selected. */
    addMoon(moon: string): void {
      if (store.asset().kind !== 'planet' || store.target().kind !== 'body') return;
      const moons = store._moons();
      const added = { id: moon, key: nextMoonKey(moons), orbit: DEFAULT_ORBIT };
      changeMoons(() => addMoonTo(moons, [], added));
      store.expand(ASSET);
      patchState(store, { selected: moonKey([moons.length]) });
    },
    /** The selected moon taken out (with its own): the planet selected. */
    removeMoon(): void {
      const t = store.target();
      if (t.kind === 'moon') removeMoonAt(t.path);
    },
    showOverlay(): void {
      // what is open wears no overlays of the library's own (its own are its tree)
    },
    /**
     * An overlay put on the planet open (what it wears wherever it is put, unless a scene chooses
     * otherwise) or on one of its moons, over what it wears.
     */
    addOverlay(id: string): void {
      wears((worn) => (worn.includes(id) ? worn : [...worn, id]));
    },
    removeOverlay(id: string): void {
      wears((worn) => worn.filter((w) => w !== id));
    },
    /** What the planet open or its moon selected wears back as its own (its data's; a moon's, its planet's). */
    resetOverlays(): void {
      const t = store.target();
      if (t.kind === 'moon')
        changeMoons((moons) => changeMoon(moons, t.path, (m) => without(m, ['overlays']) ?? m));
      else if (t.kind === 'body' && asset().kind === 'planet')
        draft.clearLibraryBody('planets', asset().id, ['overlays']);
    },
  };
}
