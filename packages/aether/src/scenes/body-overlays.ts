import { type BodyPath, type MoonChoices, type SceneBody, without } from './scene-settings';
import { changeAt, planetSettingsOf, settled } from './scene-bodies';
import type { BodySettings } from '../bodies/body-settings';

/**
 * A planet with the overlays it wears changed (none given: back to its own), its settings kept
 * (one kept before it had one set: those for what it wore, `now` their key).
 */
function wearing(p: SceneBody, overlays: readonly string[] | undefined, now: string): SceneBody {
  const rest = settled(without(p, ['style', 'overlays']) ?? p, planetSettingsOf(p, now));
  return { ...rest, ...(overlays ? { overlays } : {}) };
}

/** A moon with the overlays it wears changed (none given: back to its own). */
function moonWearing(m: MoonChoices, overlays: readonly string[] | undefined): MoonChoices {
  const rest = without(m, ['style', 'overlays']) ?? m;
  return { ...rest, ...(overlays ? { overlays } : {}) };
}

/**
 * The overlays a body wears chosen (the later over the earlier; [] none), over its own, its
 * settings kept (`from`: the key of what it wore, for one kept before it had one set).
 */
export const setOverlays = (
  bodies: readonly SceneBody[],
  path: BodyPath,
  overlays: readonly string[],
  from: string,
) =>
  changeAt(
    bodies,
    path,
    (p) => wearing(p, overlays, from),
    (m) => moonWearing(m, overlays),
  );

/** What a body wears back as its own (its settings for it kept, as `setOverlays` keeps them). */
export const resetOverlays = (
  bodies: readonly SceneBody[],
  path: BodyPath,
  from: string,
  own: readonly string[],
) =>
  changeAt(
    bodies,
    path,
    (p) => wearing(wearing(p, own, from), undefined, from),
    (m) => moonWearing(m, undefined),
  );

/**
 * Settings with an overlay the body wears switched on or off: back to what is under this level
 * (`below`) where that is the same (not set here), else set here.
 */
export function withOverlaySwitched(
  s: BodySettings,
  id: string,
  on: boolean,
  below: boolean,
): BodySettings | undefined {
  const enabled = { ...s.overlaysEnabled };
  if (on === below && s.overlayEnabled === undefined) delete enabled[id];
  else enabled[id] = on;
  return without(
    { ...s, overlaysEnabled: enabled },
    Object.keys(enabled).length ? [] : ['overlaysEnabled'],
  );
}
