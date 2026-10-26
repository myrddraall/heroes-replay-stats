import {
  addMoon as addMoonTo,
  type BodySettings,
  changeMoon,
  DEFAULT_ORBIT,
  type Orbit,
  without,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { patchState } from '@ngrx/signals';
import { axisAids, axisFrame, poleAt, poleDragged } from '../../../editing/model/markers';
import type { PoleDrag } from '../../../viewport/scene-markers';
import { ASSET, libraryKind, moonKey, nextMoonKey } from '../../asset-targets';
import type { AssetMethodsStore } from '../../asset-editor.store';
import type { AssetWrites } from './asset-writes';

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
