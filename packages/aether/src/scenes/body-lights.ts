import { without } from './scene-settings';
import type { AddedLight, LightId, LightSettings } from '../lights/lights';
import type { BodySettings } from '../bodies/body-settings';

/**
 * A body's shadow as set before its lights were objects (`shade`, `shadeTowards`), as its shadow
 * light's settings.
 */
export function legacyShadow(s: BodySettings): LightSettings {
  return {
    ...(s.shade !== undefined ? { strength: s.shade } : {}),
    ...(s.shadeTowards !== undefined ? { from: s.shadeTowards } : {}),
  };
}

/**
 * Settings with one light's changed (its others, and the other lights', kept); the shadow's taking
 * in what was set for it before lights were objects.
 */
export function withLightSetting(
  s: BodySettings,
  id: LightId,
  change: Partial<LightSettings>,
): BodySettings {
  const shadow = id === 'shadow';
  const rest = shadow ? (without(s, ['shade', 'shadeTowards']) ?? {}) : s;
  const before = { ...(shadow ? legacyShadow(s) : {}), ...s.lights?.[id] };
  return { ...rest, lights: { ...s.lights, [id]: { ...before, ...change } } };
}

/** Settings with one light's taken back (all of it: `keys` left out); none left: none at all. */
export function withoutLightSetting(
  s: BodySettings,
  id: LightId,
  keys?: readonly (keyof LightSettings)[],
): BodySettings | undefined {
  const shadow = id === 'shadow';
  const before = { ...(shadow ? legacyShadow(s) : {}), ...s.lights?.[id] };
  const rest = shadow ? (without(s, ['shade', 'shadeTowards']) ?? {}) : s;
  const lights: Partial<Record<LightId, LightSettings>> = { ...rest.lights };
  const left = keys ? without(before, keys) : undefined;
  if (left) lights[id] = left;
  else delete lights[id];
  return without({ ...rest, lights }, Object.keys(lights).length ? [] : ['lights']);
}

/** A light added to the body's settings (after any added before). */
export function withAddedLight(s: BodySettings, light: AddedLight): BodySettings {
  return { ...s, added: [...(s.added ?? []), light] };
}

/**
 * Settings with a light changed: one added at this level, itself (its settings are its own);
 * any other (its rig's, or one added under this level), what is set for it here.
 */
export function withLightChange(
  s: BodySettings,
  id: LightId,
  change: Partial<LightSettings>,
): BodySettings {
  if (s.added?.some((l) => l.id === id)) return { ...s, added: changedLight(s.added, id, change) };
  return withLightSetting(s, id, change);
}

/**
 * Settings with a light switched on or off: one added at this level, itself (on: as it starts, so
 * not kept); any other, back to what is under this level (`below`) where that is the same (not set
 * here), else set here.
 */
export function withLightSwitched(
  s: BodySettings,
  id: LightId,
  on: boolean,
  below: boolean,
): BodySettings | undefined {
  if (s.added?.some((l) => l.id === id)) return withLightChange(s, id, { enabled: on });
  return on === below
    ? withoutLightSetting(s, id, ['enabled'])
    : withLightSetting(s, id, { enabled: on });
}

/** Settings with an added light taken out, and what was set for it; none left: none at all. */
export function withoutAddedLight(s: BodySettings, id: LightId): BodySettings | undefined {
  const added = (s.added ?? []).filter((l) => l.id !== id);
  const lights: Partial<Record<LightId, LightSettings>> = { ...s.lights };
  delete lights[id];
  return without({ ...s, added, lights }, [
    ...(added.length ? [] : (['added'] as const)),
    ...(Object.keys(lights).length ? [] : (['lights'] as const)),
  ]);
}

/** Lights with one of them changed (switched on: as an added light starts, so not kept). */
export function changedLight(
  lights: readonly AddedLight[],
  id: LightId,
  change: Partial<LightSettings>,
): AddedLight[] {
  return lights.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...change };
    return next.enabled === true ? (without(next, ['enabled']) ?? next) : next;
  });
}
