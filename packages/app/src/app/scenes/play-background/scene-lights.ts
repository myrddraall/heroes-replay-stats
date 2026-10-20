import { lightFrom, normalized, type Vec3 } from './scene-directions';
import type { BodyShade, PlanetLight } from './scene-planets';

/**
 * A body's lights as objects: its light rig from the game data (an ambient light, and its
 * directional lights, named by how bright they are: its key, fill and back), and its shadow (a
 * light that darkens: the shade). Each light's settings (on or off, colour, strength, where it
 * comes from, a shadow's softness) apply over the data's only where set, so a body nothing is set
 * for is lit exactly as its data lights it.
 */

/** What a light does: lights from all round, lights from a side, or darkens from a side (an antilight). */
export type LightKind = 'ambient' | 'directional' | 'shadow';

/**
 * The kinds there are: lights of others kept from before (a grid's reveal and activation, its
 * material's own settings now) are left out wherever lights are read.
 */
const KINDS: readonly string[] = ['ambient', 'directional', 'shadow'];

/** Added lights of the kinds there are (those kept from before left out). */
export const knownLights = <T extends { readonly kind: string }>(added: readonly T[]): T[] =>
  added.filter((l) => KINDS.includes(l.kind));

/**
 * A light by what it is: a body's rig's ambient, its directional lights by index, its shadow; or
 * one added (to a scene, a body, an overlay), by the id it was given.
 */
export type LightId = 'ambient' | `directional-${number}` | 'shadow' | `added-${string}`;

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
    shadow: 'Antilight',
  }[kind];
  const name = count ? `${base} ${count + 1}` : base;
  switch (kind) {
    case 'ambient':
      return { id, kind, name, colour: '#ffffff', strength: 0.2 };
    case 'directional':
      return { id, kind, name, colour: '#ffffff', strength: 1, from: NEW_FROM };
    case 'shadow':
      return { id, kind, name, strength: 0.5, from: NEW_SHADOW_FROM, softness: 1 };
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
    ...(light.kind !== 'ambient'
      ? { from: s.from ?? (light.kind === 'shadow' ? NEW_SHADOW_FROM : NEW_FROM) }
      : {}),
    ...(light.kind === 'shadow' ? { softness: s.softness ?? 1 } : {}),
  };
}

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

/**
 * A body's light rig as its tuning has it (and its settings from before lights were objects, over
 * that): turned as a whole so its key light comes from `from`, and each of its lights `lighting`
 * times as strong. Its lights as they start, each one's own settings over them.
 */
export function tunedRig(light: PlanetLight, lighting = 1, from?: Vec3): PlanetLight {
  const turned = from ? lightFrom(light, from) : light;
  if (lighting === 1) return turned;
  const times = (c: readonly number[]) => c.map((v) => v * lighting) as unknown as Vec3;
  return {
    ...turned,
    ambient: times(turned.ambient),
    directional: turned.directional.map((l) => ({ ...l, color: times(l.color) })),
  };
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
): BodyLight[] {
  const out: BodyLight[] = [];
  const set = (id: LightId, own: Omit<BodyLight, 'enabled'>): BodyLight => {
    const s = settings[id];
    return {
      ...own,
      enabled: s?.enabled ?? true,
      ...(s?.name !== undefined ? { name: s.name } : {}),
      ...(s?.colour !== undefined ? { colour: s.colour } : {}),
      ...(s?.strength !== undefined ? { strength: s.strength } : {}),
      ...(s?.from !== undefined ? { from: s.from } : {}),
      ...(s?.softness !== undefined ? { softness: s.softness } : {}),
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
      name: 'Antilight',
      colour: '#000000',
      strength: shade.strength,
      from: shade.direction,
      softness: shade.softness,
    }),
  );
  return out;
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

/** A body's parts' materials (by `PartKey`), to tell what a light reaching a part reaches. */
export type PartMaterials = ReadonlyMap<string, readonly string[]>;

/**
 * Whether a light that reaches `reach` reaches a part (any material on it) or a material (on any
 * part it is drawn on).
 */
export function reachesReceiver(
  reach: LightReach | undefined,
  receiver: Receiver,
  parts: PartMaterials,
): boolean {
  const [kind, name] = splitReceiver(receiver);
  return [...parts].some(([part, materials]) =>
    kind === 'part'
      ? part === name && materials.some((m) => reaches(reach, part, m))
      : materials.includes(name) && reaches(reach, part, name),
  );
}

/**
 * A light's reach with a part or material (`receiver`) taken in or left out, the rest as it was:
 * a part named for it standing for a material taken in or left out is named by its other
 * materials instead (a material is named for every part it is on). None: it reaches everything.
 */
export function withReceiver(
  reach: LightReach | undefined,
  receiver: Receiver,
  on: boolean,
  parts: PartMaterials,
): LightReach | undefined {
  const [kind, name] = splitReceiver(receiver);
  const mode = reach?.mode ?? 'except';
  let list = [...(reach?.receivers ?? [])];
  // Named in the list as it is to be (an `only` reach's when taken in; an `except`'s when left out).
  const named = (mode === 'only') === on;
  if (kind === 'part') {
    const own = (parts.get(name) ?? []).map((m) => `material:${m}` as const);
    list = list.filter((r) => r !== receiver && !own.includes(r as `material:${string}`));
    if (named) list.push(receiver);
  } else {
    // A part named that has it on, where it is to be apart from the part: named by its other
    // materials instead.
    for (const [part, materials] of parts)
      if (!named && materials.includes(name) && list.includes(`part:${part}`))
        list = [
          ...list.filter((r) => r !== `part:${part}`),
          ...materials.filter((m) => m !== name).map((m) => `material:${m}` as const),
        ];
    list = list.filter((r) => r !== receiver);
    if (named) list.push(receiver);
  }
  const receivers = [...new Set(list)];
  return mode === 'except' && !receivers.length ? undefined : { mode, receivers };
}

const splitReceiver = (r: Receiver): ['part' | 'material', string] => {
  const at = r.indexOf(':');
  return [r.slice(0, at) as 'part' | 'material', r.slice(at + 1)];
};

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
  return knownLights(added)
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
  return knownLights(added)
    .map((l) => addedLight(l, settings?.[l.id]))
    .filter((l) => l.enabled);
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
