import type {
  LightId,
  LightReach,
  LightSettings,
  Receiver,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import type { BodyInfo } from '../bodies/body';
import { lightLevelsOf, litByOf, type OuterLight, receiversOf } from './lights';

/** A part or material of a body as a light's Linking shows it: whether the light reaches it. */
export interface LinkPart {
  readonly receiver: Receiver;
  readonly label: string;
  readonly material: boolean;
  readonly lit: boolean;
}

/**
 * Something a light lights, as its Linking lists it: a body (its own first, then each other it
 * reaches, moons under their planet) or a group put in the scene; whether the light lights it (its
 * own body: always, its parts as checked), whether that is set at the level edited, and its parts
 * and materials one level down (a group's: none).
 */
export interface LinkEntry {
  readonly key: string;
  readonly label: string;
  readonly depth: number;
  readonly own: boolean;
  readonly lit: boolean;
  readonly changed: boolean;
  /** The level under the one edited that leaves it out or some of it, where one does (none for its own body). */
  readonly origin?: string;
  readonly parts: readonly LinkPart[];
  /** What the light reaches of it, where not all of it (some of its parts or materials left out). */
  readonly reach?: LightReach;
}

/** A light taken in or left out by something it lights (`key`), or one of its parts or materials. */
export interface LinkChange {
  readonly key: string;
  readonly receiver: Receiver | null;
  readonly on: boolean;
}

/**
 * A body as a light's Linking shows it (see `LinkEntry`), by what lights it (`outer`, from beyond
 * it): the light as the body knows it (`id`; none: it does nothing to the body, nothing of it lit).
 * What it lights is what the body's Lit by says, and changed the same way: one setting, two views.
 */
export function bodyLink(
  b: BodyInfo,
  id: LightId,
  outer: readonly OuterLight[],
  at: {
    readonly key: string;
    readonly label: string;
    readonly depth: number;
    readonly own: boolean;
  },
): LinkEntry | null {
  const light = litByOf(b, null, outer).find((l) => l.id === id);
  if (!light) return null;
  const parts = receiversOf(b).flatMap((r) => {
    const reaching = litByOf(b, r.receiver, outer).find((l) => l.id === id);
    return reaching ? [{ ...r, lit: reaching.reaches }] : [];
  });
  const set = b.settings.lights?.[id];
  const says = (s: LightSettings | undefined) => s?.enabled !== undefined || s?.reach !== undefined;
  const origin = at.own
    ? undefined
    : lightLevelsOf(b)
        .reverse()
        .find(([, level]) => says(level?.[id]))?.[0];
  return {
    ...at,
    lit: light.reaches,
    changed: !at.own && says(set),
    ...(origin ? { origin } : {}),
    parts,
    ...(light.reach && parts.some((p) => !p.lit) ? { reach: light.reach } : {}),
  };
}
