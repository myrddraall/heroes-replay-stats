import { normalized, TOWARDS_EYE, type Vec3 } from './scene-directions';
import type { BodyShade, PlanetLight } from './scene-planets';

/**
 * A body's lights as objects: its light rig from the game data (an ambient light, and its
 * directional lights, named by how bright they are: its key, fill and back), and its shadow (a
 * light that darkens: the shade). Each light's settings (on or off, colour, strength, where it
 * comes from, a shadow's softness) apply over the data's only where set, so a body nothing is set
 * for is lit exactly as its data lights it.
 */

/**
 * What a light does: lights from all round, lights from a side, or darkens from a side; or, for a
 * grid (a drawn pattern) only, reveals it (how much of it shows at all, from a side) or activates
 * it (its colour from inactive to active, the more of it the more active).
 */
export type LightKind = 'ambient' | 'directional' | 'shadow' | 'reveal' | 'activation';

/** The kinds that act on a grid (`FieldLight`s) rather than light or shade a body. */
export const GRID_LIGHTS: readonly LightKind[] = ['reveal', 'activation'];

/**
 * A light by what it is: a body's rig's ambient, its directional lights by index, its shadow; or
 * one added (to a scene, a body, an overlay), by the id it was given.
 */
export type LightId =
  'ambient' | `directional-${number}` | 'shadow' | 'reveal' | 'activation' | `added-${string}`;

/** What of its body a light may light: one of its parts (by `PartKey`), or one of its materials (by name). */
export type Receiver = `part:${string}` | `material:${string}`;

/**
 * Which of its body's parts and materials a light reaches (its linking): only those named, or all
 * but them. A part named stands for every material drawn on it.
 */
export interface LightReach {
  readonly mode: 'only' | 'except';
  readonly receivers: readonly Receiver[];
}

/**
 * A light's settings, each where set: on or off, colour (`#rrggbb`) and strength, the side it
 * comes from, a shadow's softness; what of its body it reaches (all of it unless set), and, one
 * added to a body, whether it reaches the body's moons too (theirs too).
 */
export interface LightSettings {
  /** Its name as shown, in place of its own (a rig's light's, by how bright it is). */
  readonly name?: string;
  readonly enabled?: boolean;
  readonly colour?: string;
  readonly strength?: number;
  readonly from?: Vec3;
  readonly softness?: number;
  /** A reveal's or activation's: how far across the face it reaches (0 to 1), and how sharply it falls off. */
  readonly spread?: number;
  readonly falloff?: number;
  /** An activation's: how much it reveals too, of what it activates (0: none, only its colour). */
  readonly energizes?: number;
  /** An activation's: whether its side is its body's reveal light's (moving with it). */
  readonly tied?: boolean;
  readonly reach?: LightReach;
  readonly moons?: boolean;
}

/** Lights' settings by light. */
export type LightSettingsMap = Readonly<Partial<Record<LightId, LightSettings>>>;

/** A light added to a scene, a body or an overlay: what it does, its name and its settings. */
export interface AddedLight extends LightSettings {
  readonly id: `added-${string}`;
  readonly kind: LightKind;
  readonly name: string;
}

/** Where a light comes from unless turned: upper left, in front (a shadow: lower right, in front). */
const NEW_FROM: Vec3 = normalized([-0.55, -0.45, 0.7]);
const NEW_SHADOW_FROM: Vec3 = normalized([0.6, -0.3, -0.75]);

/** A new reveal's and activation's own (a reveal straight at the eye, as a grid with no turn has it). */
const NEW_REVEAL = { from: TOWARDS_EYE, spread: 1, falloff: 1 } as const;
const NEW_ACTIVATION = NEW_REVEAL;
/**
 * How strongly a new reveal light (and a grid's own) acts: enough, from the front with the most
 * spread, to show all of a sphere's face fully (as the game shows a grid), its side and falloff
 * telling once it is turned or narrowed. An activation light: half that.
 */
const REVEAL_STRENGTH = 2;
const ACTIVATION_STRENGTH = 1;
/** How much a grid's own activation light reveals too: a little (a new one: none). */
const GRID_ENERGIZES = 0.25;

/** A new light of a kind, named after the lights of that kind already added beside it. */
export function newLight(
  kind: LightKind,
  existing: readonly { readonly kind: LightKind }[],
): AddedLight {
  const id = `added-${Math.random().toString(36).slice(2, 10)}` as const;
  const count = existing.filter((l) => l.kind === kind).length;
  const base = {
    ambient: 'Ambient light',
    directional: 'Directional light',
    shadow: 'Shadow',
    reveal: 'Reveal light',
    activation: 'Activation light',
  }[kind];
  const name = count ? `${base} ${count + 1}` : base;
  switch (kind) {
    case 'ambient':
      return { id, kind, name, colour: '#ffffff', strength: 0.2 };
    case 'directional':
      return { id, kind, name, colour: '#ffffff', strength: 1, from: NEW_FROM };
    case 'shadow':
      return { id, kind, name, strength: 0.5, from: NEW_SHADOW_FROM, softness: 1 };
    case 'reveal':
      return { id, kind, name, strength: REVEAL_STRENGTH, ...NEW_REVEAL };
    case 'activation':
      return { id, kind, name, strength: ACTIVATION_STRENGTH, ...NEW_ACTIVATION };
  }
}

/** An added light as shown, with what is set for it over its own settings (by its id). */
export function addedLight(light: AddedLight, settings?: LightSettings): BodyLight {
  const s = { ...light, ...settings };
  return {
    id: light.id,
    kind: light.kind,
    name: s.name,
    enabled: s.enabled ?? true,
    colour: s.colour ?? (light.kind === 'shadow' ? '#000000' : '#ffffff'),
    strength: s.strength ?? 1,
    ...(light.kind !== 'ambient' ? { from: s.from ?? ownOf(light.kind).from } : {}),
    ...(light.kind === 'shadow' ? { softness: s.softness ?? 1 } : {}),
    ...(GRID_LIGHTS.includes(light.kind)
      ? {
          spread: s.spread ?? ownOf(light.kind).spread,
          falloff: s.falloff ?? ownOf(light.kind).falloff,
        }
      : {}),
    ...(light.kind === 'activation' ? { energizes: s.energizes ?? 0, tied: s.tied ?? false } : {}),
  };
}

/** A kind's own side (and a grid light's spread and falloff), where none is set. */
const ownOf = (kind: LightKind) =>
  kind === 'reveal'
    ? NEW_REVEAL
    : kind === 'activation'
      ? NEW_ACTIVATION
      : { ...NEW_ACTIVATION, from: NEW_FROM };

/** A light as shown: what it is, its name, and its settings in effect. */
export interface BodyLight {
  readonly id: LightId;
  readonly kind: LightKind;
  readonly name: string;
  readonly enabled: boolean;
  readonly colour: string;
  readonly strength: number;
  readonly from?: Vec3;
  readonly softness?: number;
  readonly spread?: number;
  readonly falloff?: number;
  readonly energizes?: number;
  readonly tied?: boolean;
}

/** The directional lights' names by how bright they are, brightest first. */
const RANKS = ['Key light', 'Fill light', 'Back light'];

/** A light's colour as a colour and a strength: the colour at its brightest channel 1. */
export function colourAndStrength(rgb: readonly number[]): { colour: string; strength: number } {
  const strength = Math.max(0, ...rgb);
  if (strength <= 0) return { colour: '#ffffff', strength: 0 };
  const hex = rgb
    .map((c) => Math.round(Math.min(1, Math.max(0, c / strength)) * 255))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('');
  return { colour: `#${hex}`, strength };
}

/** A colour (`#rrggbb`) at a strength, as the rig's colours are: each channel 0 to 1 times the strength. */
export function rgbOf(colour: string, strength: number): Vec3 {
  const n = Number.parseInt(colour.slice(1), 16);
  return [
    (((n >> 16) & 255) / 255) * strength,
    (((n >> 8) & 255) / 255) * strength,
    ((n & 255) / 255) * strength,
  ];
}

const brightness = (rgb: readonly number[]) =>
  0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;

/**
 * A body's lights as the data has them, with their settings in effect: its rig's (none where it
 * has no rig: its materials aren't lit), and its shadow (`shade`, as its settings come to).
 */
export function bodyLights(
  light: PlanetLight | undefined,
  shade: BodyShade,
  settings: LightSettingsMap = {},
  grid = false,
): BodyLight[] {
  const out: BodyLight[] = [];
  const set = (id: LightId, own: Omit<BodyLight, 'enabled'>, on = true): BodyLight => {
    const s = settings[id];
    return {
      ...own,
      enabled: s?.enabled ?? on,
      ...(s?.name !== undefined ? { name: s.name } : {}),
      ...(s?.colour !== undefined ? { colour: s.colour } : {}),
      ...(s?.strength !== undefined ? { strength: s.strength } : {}),
      ...(s?.from !== undefined ? { from: s.from } : {}),
      ...(s?.softness !== undefined ? { softness: s.softness } : {}),
      ...(s?.spread !== undefined ? { spread: s.spread } : {}),
      ...(s?.falloff !== undefined ? { falloff: s.falloff } : {}),
      ...(s?.energizes !== undefined ? { energizes: s.energizes } : {}),
      ...(s?.tied !== undefined ? { tied: s.tied } : {}),
    };
  };
  if (light) {
    out.push(
      set('ambient', {
        id: 'ambient',
        kind: 'ambient',
        name: 'Ambient light',
        ...colourAndStrength(light.ambient),
      }),
    );
    const byBrightness = light.directional
      .map((l, i) => ({ i, b: brightness(l.color) }))
      .sort((a, b) => b.b - a.b || a.i - b.i);
    light.directional.forEach((l, i) => {
      const rank = byBrightness.findIndex((x) => x.i === i);
      const d = normalized(l.direction);
      out.push(
        set(`directional-${i}`, {
          id: `directional-${i}`,
          kind: 'directional',
          name: RANKS[rank] ?? `Light ${rank + 1}`,
          ...colourAndStrength(l.color),
          from: [-d[0], -d[1], -d[2]],
        }),
      );
    });
  }
  out.push(
    set('shadow', {
      id: 'shadow',
      kind: 'shadow',
      name: 'Shadow',
      colour: '#000000',
      strength: shade.strength,
      from: shade.direction,
      softness: shade.softness,
    }),
  );
  // A grid's reveal light (revealing all of its face as the game shows it) and its activation
  // light (switched off unless switched on; its side the reveal's while tied to it).
  if (grid)
    out.push(
      set('reveal', {
        id: 'reveal',
        kind: 'reveal',
        name: 'Reveal light',
        colour: '#ffffff',
        strength: REVEAL_STRENGTH,
        ...NEW_REVEAL,
      }),
      set(
        'activation',
        {
          id: 'activation',
          kind: 'activation',
          name: 'Activation light',
          colour: '#ffffff',
          strength: ACTIVATION_STRENGTH,
          energizes: GRID_ENERGIZES,
          tied: true,
          ...NEW_ACTIVATION,
        },
        false,
      ),
    );
  return out;
}

/**
 * A reveal or activation light as a grid is drawn with it: the side it comes from (body frame),
 * how far round it reaches (0: the half facing it; 1: all of it evenly), how sharply it falls off,
 * its strength; an activation's, how much it reveals too, and whether its side is its body's
 * reveal light's.
 */
export interface FieldLight {
  readonly from: Vec3;
  readonly spread: number;
  readonly falloff: number;
  readonly strength: number;
  readonly energizes?: number;
  readonly tied?: boolean;
}

/** A grid's own reveal light as set (none where it is switched off, or doesn't reach). */
export function dataReveal(settings: LightSettings | undefined): FieldLight | null {
  if (settings?.enabled === false) return null;
  return {
    from: settings?.from ?? NEW_REVEAL.from,
    spread: settings?.spread ?? NEW_REVEAL.spread,
    falloff: settings?.falloff ?? NEW_REVEAL.falloff,
    strength: settings?.strength ?? REVEAL_STRENGTH,
  };
}

/** The side a grid's own reveal light comes from, as set (what an activation tied to it takes). */
export const revealFrom = (settings: LightSettingsMap | undefined): Vec3 =>
  settings?.reveal?.from ?? NEW_REVEAL.from;

/**
 * A grid's own activation light as set: none unless switched on; as its reveal light is unless set,
 * not as strongly, energizing a little, its side tied to the reveal's.
 */
export function dataActivation(settings: LightSettings | undefined): FieldLight | null {
  if (settings?.enabled !== true) return null;
  return {
    from: settings.from ?? NEW_ACTIVATION.from,
    spread: settings.spread ?? NEW_ACTIVATION.spread,
    falloff: settings.falloff ?? NEW_ACTIVATION.falloff,
    strength: settings.strength ?? ACTIVATION_STRENGTH,
    energizes: settings.energizes ?? GRID_ENERGIZES,
    tied: settings.tied ?? true,
  };
}

/** The reveal or activation lights added to a body (its own, its overlay's, its scene's), as set, on ones only. */
export function fieldLights(
  kind: 'reveal' | 'activation',
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
): FieldLight[] {
  return onLights(added, settings)
    .filter((l) => l.kind === kind)
    .map((l) => ({
      from: l.from ?? ownOf(kind).from,
      spread: l.spread ?? ownOf(kind).spread,
      falloff: l.falloff ?? ownOf(kind).falloff,
      strength: l.strength,
      ...(kind === 'activation' ? { energizes: l.energizes ?? 0, tied: l.tied ?? false } : {}),
    }));
}

/** A light rig with its lights' settings applied (each where set; one switched off gives no light). */
export function withLightSettings(light: PlanetLight, settings?: LightSettingsMap): PlanetLight {
  if (!settings) return light;
  const rgb = (id: LightId, own: readonly number[]): Vec3 | readonly number[] => {
    const s = settings[id];
    if (!s) return own;
    if (s.enabled === false) return [0, 0, 0];
    if (s.colour === undefined && s.strength === undefined) return own;
    const was = colourAndStrength(own);
    return rgbOf(s.colour ?? was.colour, s.strength ?? was.strength);
  };
  return {
    ...light,
    ambient: rgb('ambient', light.ambient) as PlanetLight['ambient'],
    directional: light.directional.map((l, i) => {
      const id: LightId = `directional-${i}`;
      const from = settings[id]?.from;
      return {
        color: rgb(id, l.color) as PlanetLight['ambient'],
        direction: from ? ([-from[0], -from[1], -from[2]] as const) : l.direction,
      };
    }),
  };
}

/** A shade with its shadow light's settings applied (switched off: no shade). */
export function withShadowSettings(shade: BodyShade, settings?: LightSettings): BodyShade {
  if (!settings) return shade;
  return {
    direction: settings.from ?? shade.direction,
    strength: settings.enabled === false ? 0 : (settings.strength ?? shade.strength),
    softness: settings.softness ?? shade.softness,
  };
}

/** Whether a light that reaches `reach` (all where none) reaches a part (by key) and a material on it. */
export function reaches(
  reach: LightReach | undefined,
  part: string | undefined,
  material: string,
): boolean {
  if (!reach) return true;
  const named = reach.receivers.some(
    (r) => r === `material:${material}` || (part !== undefined && r === `part:${part}`),
  );
  return reach.mode === 'only' ? named : !named;
}

/**
 * Lights' settings for one part and material of a body (`settings`, with the lights added to it):
 * each light that doesn't reach it switched off there (its reach as set, else an added light's own).
 */
export function linkedSettings(
  settings: LightSettingsMap | undefined,
  added: readonly AddedLight[],
  part: string | undefined,
  material: string,
): LightSettingsMap | undefined {
  const off: Partial<Record<LightId, LightSettings>> = {};
  const ids = new Set<LightId>([
    ...(Object.keys(settings ?? {}) as LightId[]),
    ...added.map((l) => l.id),
  ]);
  for (const id of ids) {
    const reach = settings?.[id]?.reach ?? added.find((l) => l.id === id)?.reach;
    if (!reaches(reach, part, material)) off[id] = { ...settings?.[id], enabled: false };
  }
  return Object.keys(off).length ? { ...settings, ...off } : settings;
}

/**
 * The lights added to a body that reach its moons too, as set (their settings in them), for a
 * moon: each reaches the whole moon (its reach was among its own body's parts).
 */
export function lightsForMoons(
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
): AddedLight[] {
  return added
    .map((l) => ({ ...l, ...settings?.[l.id] }))
    .filter((l) => l.moons === true && l.enabled !== false)
    .map((l) => ({ ...l, reach: undefined, moons: undefined }));
}

/** Lights' settings from several levels, the later over the earlier, each setting its own. */
export function mergeLightSettings(
  ...levels: readonly (LightSettingsMap | undefined)[]
): LightSettingsMap {
  const out: Partial<Record<LightId, LightSettings>> = {};
  for (const level of levels)
    for (const [id, s] of Object.entries(level ?? {}) as [LightId, LightSettings][])
      out[id] = { ...out[id], ...s };
  return out;
}

/** The lights added to a body (its own, its overlay's, its scene's), as set over their own settings, on ones only. */
function onLights(added: readonly AddedLight[], settings?: LightSettingsMap): BodyLight[] {
  return added.map((l) => addedLight(l, settings?.[l.id])).filter((l) => l.enabled);
}

/**
 * A body's light rig with the lights added to it: their light from all round added to its ambient,
 * their directional lights after its own. A body without a rig is lit by them alone (at the scene's
 * exposure); none at all: unlit.
 */
export function withAddedLights(
  light: PlanetLight | undefined,
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
  exposure: number,
): PlanetLight | undefined {
  const on = onLights(added, settings).filter(
    (l) => l.kind === 'ambient' || l.kind === 'directional',
  );
  if (!on.length) return light;
  const base: PlanetLight = light ?? { ambient: [0, 0, 0], directional: [], exposure };
  const ambient = on
    .filter((l) => l.kind === 'ambient')
    .reduce((sum, l) => {
      const c = rgbOf(l.colour, l.strength);
      return [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]] as const;
    }, base.ambient);
  const directional = on
    .filter((l) => l.kind === 'directional' && l.from)
    .map((l) => ({
      direction: [-l.from![0], -l.from![1], -l.from![2]] as const,
      color: rgbOf(l.colour, l.strength),
    }));
  return { ...base, ambient, directional: [...base.directional, ...directional] };
}

/** The shadows added to a body, as shades (its own shade is apart). */
export function addedShades(
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
): BodyShade[] {
  return onLights(added, settings)
    .filter((l) => l.kind === 'shadow' && l.from)
    .map((l) => ({ direction: l.from!, strength: l.strength, softness: l.softness ?? 1 }));
}
