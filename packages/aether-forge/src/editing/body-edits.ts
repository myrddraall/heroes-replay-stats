import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';
import type { PartKey, PartSettings } from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  type AddedLight,
  type LightId,
  type LightSettings,
  type NewLightKind,
  newLight,
  type Receiver,
  withLightChanged,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import {
  without,
  withAddedLight,
  withLightChange,
  withLightSwitched,
  withMaterial,
  withMaterialSwitched,
  withoutAddedLight,
  withoutLightSetting,
  withoutMaterial,
  withoutPartSetting,
  withOverlaySwitched,
  withPartSetting,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { type BodyInfo, overlayEnabledBelow } from '../bodies/body';
import { type LitByEntry, lightsOfBody, withLitBy } from '../lights/lights';
import { materialAt, materialsOf, movedInPart, movedShape } from '../materials/materials';
import { partsOfBody } from '../parts/parts';
import { keepingPose } from '../viewport/markers';

/**
 * Where an edit of a body lands: the level edited (a scene's copy of a planet or moon, a library
 * planet, a variant of it being edited, one of its own moons). The body as it is seen there, and
 * its settings there changed; each editor says which level is edited, the edits are the same.
 */
export interface BodyLevel {
  readonly body: BodyInfo;
  /** Its settings at the level changed (none left: none kept there). */
  change(change: (s: BodySettings) => BodySettings | undefined): void;
}

/**
 * The edits both editors make to a body, at the level edited (see `BodyLevel`). A switch puts a
 * thing back as the levels under it have it where that is the same, else sets it there.
 */
export const bodyEdits = {
  /** Its own settings changed, or taken back; kept where it is as its Axis moves (see `keepingPose`). */
  setBody(l: BodyLevel, change: Partial<BodySettings>): void {
    l.change((s) =>
      posed(l.body, { ...s, ...change }, Object.keys(change) as (keyof BodySettings)[]),
    );
  },
  clearBody(l: BodyLevel, keys: readonly (keyof BodySettings)[]): void {
    l.change((s) => posed(l.body, without(s, keys) ?? {}, keys));
  },
  /** Drawn or not (one of a planet's own moons may be off under it). */
  switchBody(l: BodyLevel, on: boolean): void {
    const below = l.body.below?.enabled !== false;
    l.change((s) => (on === below ? without(s, ['enabled']) : { ...s, enabled: on }));
  },

  setMaterial(l: BodyLevel, key: string, change: Partial<MaterialSettings>): void {
    l.change((s) => withMaterial(s, key, change));
  },
  clearMaterial(l: BodyLevel, key: string, keys?: readonly (keyof MaterialSettings)[]): void {
    l.change((s) => withoutMaterial(s, key, keys));
  },
  switchMaterial(l: BodyLevel, key: string, on: boolean): void {
    const below = materialAt(materialsOf(l.body), key)?.enabledBelow ?? true;
    l.change((s) => withMaterialSwitched(s, key, on, below));
  },
  /** One of a shield's lights switched: the shield's lights set there. */
  switchShieldLight(l: BodyLevel, key: string, id: `added-${string}`, on: boolean): void {
    const lights = materialAt(materialsOf(l.body), key)?.values.gridLights ?? [];
    l.change((s) =>
      withMaterial(s, key, { gridLights: withLightChanged(lights, id, { enabled: on }) }),
    );
  },
  /** A material moved before or after another drawn on the same part and as it is (see `movedInPart`). */
  moveMaterial(l: BodyLevel, from: string, to: string, after: boolean): void {
    const order = movedInPart(l.body, materialsOf(l.body), from, to, after);
    if (order) l.change((s) => ({ ...s, order }));
  },
  /** A shape moved before or after another, its materials drawn where it is put (see `movedShape`). */
  moveShape(l: BodyLevel, from: PartKey, to: PartKey, after: boolean): void {
    const order = movedShape(l.body, materialsOf(l.body), from, to, after);
    if (order) l.change((s) => ({ ...s, order }));
  },

  setPart(l: BodyLevel, key: PartKey, change: Partial<PartSettings>): void {
    l.change((s) => withPartSetting(s, key, change));
  },
  clearPart(l: BodyLevel, key: PartKey, keys?: readonly (keyof PartSettings)[]): void {
    l.change((s) => withoutPartSetting(s, key, keys));
  },
  switchPart(l: BodyLevel, key: PartKey, on: boolean): void {
    const below = partsOfBody(l.body).find((p) => p.key === key)?.enabledBelow ?? true;
    l.change((s) =>
      on === below
        ? withoutPartSetting(s, key, ['enabled'])
        : withPartSetting(s, key, { enabled: on }),
    );
  },

  switchOverlay(l: BodyLevel, id: string, on: boolean): void {
    l.change((s) => withOverlaySwitched(s, id, on, overlayEnabledBelow(l.body, id)));
  },

  setLight(l: BodyLevel, id: LightId, change: Partial<LightSettings>): void {
    l.change((s) => withLightChange(s, id, change));
  },
  clearLight(l: BodyLevel, id: LightId, keys?: readonly (keyof LightSettings)[]): void {
    l.change((s) => withoutLightSetting(s, id, keys));
  },
  switchLight(l: BodyLevel, id: LightId, on: boolean): void {
    const below = lightsOfBody(l.body).find((x) => x.light.id === id)?.enabledBelow ?? true;
    l.change((s) => withLightSwitched(s, id, on, below));
  },
  /** A new light of a kind added to it (named apart from those added before it): the light. */
  addLight(l: BodyLevel, kind: NewLightKind): AddedLight {
    const added = lightsOfBody(l.body)
      .map((x) => x.light)
      .filter((x) => x.id.startsWith('added-'));
    const light = newLight(kind, added);
    l.change((s) => withAddedLight(s, light));
    return light;
  },
  /** A light added at the level edited taken out. */
  removeLight(l: BodyLevel, id: LightId): void {
    l.change((s) => withoutAddedLight(s, id));
  },
  /** A light taken in or left out by the body, one of its parts or materials (`receiver`). */
  setLitBy(l: BodyLevel, light: LitByEntry, receiver: Receiver | null, on: boolean): void {
    l.change((s) => withLitBy(s, l.body, light, receiver, on));
  },
};

/** A body's settings after a change, kept where it is as its Axis moves (none left: none). */
function posed(
  b: BodyInfo,
  next: BodySettings,
  touched: readonly (keyof BodySettings)[],
): BodySettings | undefined {
  const kept = keepingPose(b, next, touched);
  return Object.keys(kept).length ? kept : undefined;
}
