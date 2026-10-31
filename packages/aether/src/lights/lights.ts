import { aimOf, type LookAt } from '../space/look-at';
import type { PlacementMode } from '../space/placement';
import { lightFrom, rimTurn } from '../space/directions';

export { aimAtMiddle } from '../space/look-at';

import type { BodyShade, PlanetDirectionalLight, PlanetLight } from '../formats/planet-files';
import { type Vec3, normalized } from '../space/vectors';

/**
 * A body's lights as objects: its light rig from the game data (an ambient light, and its
 * directional lights, named by how bright they are: its key, fill and back), and its shadow (a
 * directional light that darkens: the shade). Each light's settings (on or off, whether it lights
 * or darkens, colour, strength, where it comes from, softness) apply over the data's only where
 * set, so a body nothing is set for is lit exactly as its data lights it.
 */

/**
 * Where a light comes from: all round; a side; the rim (the body's edge as seen: brightest where
 * the surface turns away from the eye, leaning to a side); a point near the body (fading with
 * distance); a spot (a point, lighting within a cone); above and below (a hemisphere: one colour
 * from the sky's side, another from the ground's); the sky round the body (an environment light:
 * the sky's own colours, each side of the body lit by the sky beyond it). Any of them lights, or
 * darkens (`darkens`: taking its colour away). The same lights light a body's
 * materials and say where a shield's grid shows (`shield`).
 */
export type LightKind =
  'ambient' | 'directional' | 'rim' | 'point' | 'spot' | 'hemisphere' | 'environment';

/** What each kind of light is called (whether it darkens is a setting of any of them). */
export const LIGHT_KIND_NAMES: Readonly<Record<LightKind, string>> = {
  ambient: 'Ambient light',
  directional: 'Directional light',
  point: 'Point light',
  spot: 'Spot light',
  hemisphere: 'Hemisphere light',
  environment: 'Environment light',
  rim: 'Rim light',
};

/**
 * The kinds there are, and one kept from before (`shadow`: read as a directional light that
 * darkens). Lights of others kept from before (a grid's reveal and activation, its material's own
 * settings now) are left out wherever lights are read.
 */
const KINDS: readonly string[] = [
  'ambient',
  'directional',
  'shadow',
  'point',
  'spot',
  'hemisphere',
  'environment',
  'rim',
];

/**
 * Added lights of the kinds there are (those kept from before left out), a `shadow` of before as
 * the directional light that darkens it now is.
 */
export const knownLights = <T extends { readonly kind: string; readonly darkens?: boolean }>(
  added: readonly T[],
): T[] =>
  added
    .filter((l) => KINDS.includes(l.kind))
    .map((l) => (l.kind === 'shadow' ? { ...l, kind: 'directional', darkens: true } : l));

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
 * What a light does to a shield's grid, where it is one of the shield's lights: reveals it
 * (shows it where it reaches), activates it (colours it from inactive to active there, revealing
 * `energizes` times as much there too and shining `glow` brighter), either or both. One that
 * darkens does the opposite: hides, deactivates.
 */
export interface ShieldEffect {
  readonly reveals?: boolean;
  readonly activates?: boolean;
  readonly energizes?: number;
  readonly glow?: number;
  /**
   * How far round the grid's face what it does reaches past the half facing it (0 the half
   * facing it, 1 on round to the point facing away); from before, its light's `wrap`.
   */
  readonly spread?: number;
}

/** What a shield's light does unless set: it reveals, over the half of the grid facing it. */
export const SHIELD_DEFAULTS: Required<ShieldEffect> = {
  reveals: true,
  activates: false,
  energizes: 0.25,
  glow: 0.5,
  spread: 0,
};

/** How far round a shield's light reaches what it does (see `ShieldEffect.spread`). */
export const shieldSpreadOf = (l: {
  readonly shield?: ShieldEffect;
  readonly wrap?: number;
}): number => l.shield?.spread ?? l.wrap ?? SHIELD_DEFAULTS.spread;


/**
 * A light's settings, each where set: on or off, whether it darkens instead of lighting, colour
 * (`#rrggbb`: one that darkens takes it away) and strength, the side it comes from and how softly
 * it falls off round the body; what of its body it reaches (all of it unless set), whether it
 * lights what is under it (`down`) and how far beyond it it reaches (`out`: see `LightOut`). A
 * rim light's `from` is its
 * lean (the side of the rim it favours), its `fade` how far in from the rim it spreads (0 to 1)
 * and its `softness` its falloff.
 */
export interface LightSettings {
  /** Its name as shown, in place of its own (a rig's light's, by how bright it is). */
  readonly name?: string;
  readonly enabled?: boolean;
  readonly darkens?: boolean;
  readonly colour?: string;
  readonly strength?: number;
  readonly from?: Vec3;
  readonly softness?: number;
  /**
   * A directional light's shine on a material with a specular layer: its colour (`#rrggbb`) and
   * strength (the game's specular colour times its multiplier).
   */
  readonly specular?: string;
  readonly specularStrength?: number;
  /** A point or spot light's place, in its body's placement frame, in its radii (x across, y away from the scene's camera, z up). */
  readonly position?: Vec3;
  /**
   * How a point or spot light's place is set in the editor (none: free), and the turn of the
   * orbit it is on (kept as it moves, so its orbit stays where it was set; none: 0). Its place is
   * always kept as `position`.
   */
  readonly placement?: PlacementMode;
  readonly orbitTurn?: number;
  /**
   * How far a point or spot light reaches, in its body's radii: it fades to nothing there (half as
   * strong a fifth of the way, `HALF_REACH`), and lights nothing past it.
   */
  readonly range?: number;
  /**
   * An environment light's: how far out from the body's edge the sky is read, in its radii. A
   * point or spot light's from before it had `range`: where it was half as strong (read as a
   * range `HALF_REACH` times as far: see `rangeOf`).
   */
  readonly fade?: number;
  /** What a spot light looks at: a spot on its body's face, or a direction (none: `aim`, else its body's middle). */
  readonly lookAt?: LookAt;
  /** The way a spot light points, kept from before there was `lookAt` (none: at its body's middle). */
  readonly aim?: Vec3;
  /** A spot light's cone: its half-angle, in degrees. */
  readonly cone?: number;
  /** How much of a spot light's cone, from its edge in, it fades over (0 a hard edge, 1 all of it). */
  readonly edge?: number;
  /** A hemisphere light's colour from below (`#rrggbb`; its colour is from above, `from`). */
  readonly ground?: string;
  /** How far round the body a directional, point or spot light wraps (0 the half facing it, 1 on round to the point facing away). */
  readonly wrap?: number;
  /** What it does to a shield's grid, where it is one of the shield's lights (none: it reveals). */
  readonly shield?: ShieldEffect;
  readonly reach?: LightReach;
  /**
   * Whether it lights what is under it in the scene (its body's moons, theirs too): none, as kept
   * from before (`moons`), else no (see `downOf`).
   */
  readonly down?: boolean;
  /** How far beyond its body it reaches (none, or `none`: nowhere beyond it). */
  readonly out?: LightOut;
  /** Whether it reached its body's moons, kept from before there was `down`. */
  readonly moons?: boolean;
}

/**
 * How far beyond the body it is on a light reaches: nowhere (set over one under it that does), the
 * planet it is a moon of (with all of that planet's moons), the group it is in (all of the group's
 * bodies), or the whole scene.
 */
export type LightOut = 'none' | 'planet' | 'group' | 'scene';

/** How far beyond its body a light reaches, where it reaches beyond it at all. */
export const outOf = (s: LightSettings): Exclude<LightOut, 'none'> | undefined =>
  s.out === 'none' ? undefined : s.out;

/**
 * Whether a light lights what is under it (a body's moons): as set, else as it was set before
 * (`moons`), else not (a body's lights from its data light it alone; a light added since starts
 * on: see `newLight`).
 */
export const downOf = (s: LightSettings): boolean => s.down ?? s.moons ?? false;

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
/**
 * Where a point light is unless moved: to the right, in front, above; a spot: to the right, in
 * front, above, nearer (both in view on the stage, the spot's cone narrower than its body).
 */
const NEW_POSITION: Vec3 = [1.2, -1.2, 0.8];
const NEW_SPOT_POSITION: Vec3 = [0.8, -2, 0.9];
const NEW_RANGE = 15;
/**
 * How far a point or spot light is half as strong, as a share of its range: a fifth (as Unity's
 * lights fall off); so one from before, set by where it was half as strong, lights as it did up
 * to its range (where it was a twenty-sixth as strong) and nothing past.
 */
export const HALF_REACH = 1 / 5;

/** How far a point or spot light reaches (see `LightSettings.range`), in its body's radii. */
export const rangeOf = (l: { readonly range?: number; readonly fade?: number }): number =>
  l.range ?? (l.fade !== undefined ? l.fade / HALF_REACH : NEW_RANGE);
/** How strong a point light is, and a spot, unless set: dim enough near the body not to white it out. */
const NEW_POINT_STRENGTH = 0.5;
const NEW_SPOT_STRENGTH = 0.8;
/** A spot's cone unless set: within the body as seen from where it starts (a planet's face is about 20 degrees across from there). */
const NEW_CONE = 15;
const NEW_EDGE = 0.5;
/** Where a hemisphere light's sky is unless turned: straight up. */
const NEW_UP: Vec3 = [0, 0, 1];
const NEW_GROUND = '#000000';
/** A rim light's lean unless turned: none (its rim all round, towards the eye); how far in it spreads unless set. */
export const NEW_LEAN: Vec3 = [0, -1, 0];
const NEW_SPREAD = 0;
/** How far out from the body's edge an environment light reads the sky unless set, in its radii. */
const NEW_SKY_REACH = 1.5;

/**
 * A new light of a kind, named after the lights of that kind already added beside it; lighting
 * what is under it (see `downOf`).
 */
export function newLight(
  kind: LightKind,
  existing: readonly { readonly kind: LightKind; readonly darkens?: boolean }[],
): AddedLight {
  return { ...lightOfKind(kind, existing), down: true };
}

function lightOfKind(
  kind: LightKind,
  existing: readonly { readonly kind: LightKind; readonly darkens?: boolean }[],
): AddedLight {
  const id = `added-${Math.random().toString(36).slice(2, 10)}` as const;
  const count = existing.filter((l) => l.kind === kind).length;
  const base = LIGHT_KIND_NAMES[kind];
  const name = count ? `${base} ${count + 1}` : base;
  switch (kind) {
    case 'ambient':
      return { id, kind, name, colour: '#ffffff', strength: 0.2 };
    case 'directional':
      return { id, kind, name, colour: '#ffffff', strength: 1, from: NEW_FROM };
    case 'point':
      return {
        id,
        kind,
        name,
        colour: '#ffffff',
        strength: NEW_POINT_STRENGTH,
        position: NEW_POSITION,
        range: NEW_RANGE,
      };
    case 'spot':
      return {
        id,
        kind,
        name,
        colour: '#ffffff',
        strength: NEW_SPOT_STRENGTH,
        position: NEW_SPOT_POSITION,
        range: NEW_RANGE,
        cone: NEW_CONE,
        edge: NEW_EDGE,
      };
    case 'hemisphere':
      return {
        id,
        kind,
        name,
        colour: '#ffffff',
        strength: 0.25,
        from: NEW_UP,
        ground: NEW_GROUND,
      };
    case 'environment':
      return { id, kind, name, colour: '#ffffff', strength: 1, fade: NEW_SKY_REACH, softness: 1 };
    case 'rim':
      return { id, kind, name, colour: '#ffffff', strength: 1 };
  }
}

/** A list of lights with one of them changed (the rest as they are); one not among them: as they are. */
export function withLightChanged(
  lights: readonly AddedLight[],
  id: AddedLight['id'],
  change: Partial<LightSettings>,
): AddedLight[] {
  return lights.map((l) => (l.id === id ? { ...l, ...change } : l));
}

/** An added light as shown, with what is set for it over its own settings (by its id). */
export function addedLight(light: AddedLight, settings?: LightSettings): BodyLight {
  const s = { ...light, ...settings };
  const darkens = s.darkens ?? false;
  return {
    id: light.id,
    kind: light.kind,
    name: s.name,
    enabled: s.enabled ?? true,
    darkens,
    colour: s.colour ?? '#ffffff',
    strength: s.strength ?? 1,
    ...(light.kind === 'directional'
      ? {
          from: s.from ?? (darkens ? NEW_SHADOW_FROM : NEW_FROM),
          softness: s.softness ?? 1,
          specular: s.specular ?? '#ffffff',
          specularStrength: s.specularStrength ?? 1,
        }
      : {}),
    ...(light.kind === 'point' || light.kind === 'spot'
      ? {
          position: s.position ?? (light.kind === 'spot' ? NEW_SPOT_POSITION : NEW_POSITION),
          ...(s.placement ? { placement: s.placement } : {}),
          ...(s.orbitTurn !== undefined ? { orbitTurn: s.orbitTurn } : {}),
          range: rangeOf(s),
          softness: s.softness ?? 1,
          specular: s.specular ?? '#ffffff',
          specularStrength: s.specularStrength ?? 1,
        }
      : {}),
    ...(light.kind === 'spot'
      ? {
          ...(s.lookAt ? { lookAt: s.lookAt } : {}),
          ...(s.aim ? { aim: s.aim } : {}),
          cone: s.cone ?? NEW_CONE,
          edge: s.edge ?? NEW_EDGE,
        }
      : {}),
    ...(light.kind === 'hemisphere'
      ? { from: s.from ?? NEW_UP, ground: s.ground ?? NEW_GROUND }
      : {}),
    ...(light.kind === 'environment'
      ? { fade: s.fade ?? NEW_SKY_REACH, softness: s.softness ?? 1 }
      : {}),
    // (A rim light's lean, spread and falloff left unset: a shield fills them with its own.)
    ...(light.kind === 'rim'
      ? {
          ...(s.from ? { from: s.from } : {}),
          ...(s.fade !== undefined ? { fade: s.fade } : {}),
          ...(s.softness !== undefined ? { softness: s.softness } : {}),
        }
      : {}),
    ...(s.wrap !== undefined ? { wrap: s.wrap } : {}),
    ...(s.shield ? { shield: s.shield } : {}),
  };
}

/** A light as shown: what it is, its name, and its settings in effect. */
export interface BodyLight {
  readonly id: LightId;
  readonly kind: LightKind;
  readonly name: string;
  readonly enabled: boolean;
  /** Whether it darkens (taking its colour away) instead of lighting. */
  readonly darkens: boolean;
  readonly colour: string;
  readonly strength: number;
  readonly from?: Vec3;
  readonly softness?: number;
  /** A directional, point or spot light's shine (see `LightSettings`). */
  readonly specular?: string;
  readonly specularStrength?: number;
  /** A point or spot light's (see `LightSettings`); `fade` an environment light's and a rim's. */
  readonly position?: Vec3;
  readonly placement?: PlacementMode;
  readonly orbitTurn?: number;
  readonly range?: number;
  readonly fade?: number;
  /** A spot light's (see `LightSettings`). */
  readonly lookAt?: LookAt;
  readonly aim?: Vec3;
  readonly cone?: number;
  readonly edge?: number;
  /** A hemisphere light's colour from below. */
  readonly ground?: string;
  /** How far round the body it wraps (see `LightSettings`). */
  readonly wrap?: number;
  /** What it does to a shield's grid, where it is one of the shield's lights. */
  readonly shield?: ShieldEffect;
}

/** A light as the renderer takes it (see `PlanetDirectionalLight`): from a side, a point, a spot, above and below, or the sky round the body. */
export function placedLight(l: BodyLight): PlanetDirectionalLight | undefined {
  const color = rgbOf(l.colour, l.strength);
  const shine =
    (l.specularStrength ?? 0) > 0
      ? { specular: rgbOf(l.specular ?? '#ffffff', l.specularStrength!) }
      : {};
  const wrap = l.wrap !== undefined ? { wrap: l.wrap } : {};
  if (l.kind === 'directional' && l.from)
    return {
      direction: [-l.from[0], -l.from[1], -l.from[2]] as const,
      color,
      softness: l.softness ?? 1,
      ...wrap,
      ...shine,
    };
  if (l.kind === 'rim') {
    const lean = l.from ?? NEW_LEAN;
    const [yaw, pitch] = rimTurn(lean);
    return {
      kind: 'rim',
      direction: [-lean[0], -lean[1], -lean[2]] as const,
      aim: [-yaw, -pitch, 0],
      fade: l.fade ?? NEW_SPREAD,
      color,
      softness: l.softness ?? 1,
    };
  }
  if ((l.kind === 'point' || l.kind === 'spot') && l.position) {
    const aim = aimOf(l.position, l.lookAt, l.aim);
    return {
      kind: l.kind,
      direction: aim,
      position: l.position,
      fade: rangeOf(l),
      color,
      softness: l.softness ?? 1,
      ...wrap,
      ...(l.kind === 'spot' ? { aim, cone: l.cone ?? NEW_CONE, edge: l.edge ?? NEW_EDGE } : {}),
      ...shine,
    };
  }
  if (l.kind === 'hemisphere' && l.from)
    return {
      kind: 'hemisphere',
      direction: [-l.from[0], -l.from[1], -l.from[2]] as const,
      color,
      ground: rgbOf(l.ground ?? NEW_GROUND, l.strength),
    };
  if (l.kind === 'environment')
    return {
      kind: 'environment',
      direction: [0, 1, 0],
      color,
      fade: l.fade ?? NEW_SKY_REACH,
      softness: l.softness ?? 1,
    };
  return undefined;
}

/** A light's specular as a colour and a strength (none: white, at 0). */
function specularOf(rgb: readonly number[] | undefined): {
  specular: string;
  specularStrength: number;
} {
  const { colour, strength } = colourAndStrength(rgb ?? [0, 0, 0]);
  return { specular: colour, specularStrength: strength };
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
 * has no rig: its materials aren't lit), and its shadow (`shade`, as its settings come to: a
 * directional light that darkens, taking white away, unless set otherwise).
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
      ...(s?.darkens !== undefined ? { darkens: s.darkens } : {}),
      ...(s?.name !== undefined ? { name: s.name } : {}),
      ...(s?.colour !== undefined ? { colour: s.colour } : {}),
      ...(s?.strength !== undefined ? { strength: s.strength } : {}),
      ...(s?.from !== undefined ? { from: s.from } : {}),
      ...(s?.softness !== undefined ? { softness: s.softness } : {}),
      ...(s?.specular !== undefined ? { specular: s.specular } : {}),
      ...(s?.specularStrength !== undefined ? { specularStrength: s.specularStrength } : {}),
    };
  };
  if (light) {
    out.push(
      set('ambient', {
        id: 'ambient',
        kind: 'ambient',
        name: 'Ambient light',
        darkens: false,
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
          darkens: false,
          ...colourAndStrength(l.color),
          from: [-d[0], -d[1], -d[2]],
          softness: l.softness ?? 1,
          ...specularOf(l.specular),
        }),
      );
    });
  }
  out.push(
    set('shadow', {
      id: 'shadow',
      kind: 'directional',
      name: 'Shade',
      darkens: true,
      colour: '#ffffff',
      strength: shade.strength,
      from: shade.direction,
      softness: shade.softness,
      ...specularOf(undefined),
    }),
  );
  return out;
}

/**
 * A light rig with its lights' settings applied (each where set; one switched off, or darkening
 * instead, gives no light).
 */
export function withLightSettings(light: PlanetLight, settings?: LightSettingsMap): PlanetLight {
  if (!settings) return light;
  const rgb = (id: LightId, own: readonly number[]): Vec3 | readonly number[] => {
    const s = settings[id];
    if (!s) return own;
    if (s.enabled === false || s.darkens) return [0, 0, 0];
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
      const s = settings[id];
      const softness = s?.softness ?? l.softness;
      const was = specularOf(l.specular);
      const specular =
        s?.enabled === false || s?.darkens
          ? undefined
          : s?.specular !== undefined || s?.specularStrength !== undefined
            ? rgbOf(s.specular ?? was.specular, s.specularStrength ?? was.specularStrength)
            : l.specular;
      return {
        color: rgb(id, l.color) as PlanetLight['ambient'],
        direction: from ? ([-from[0], -from[1], -from[2]] as const) : l.direction,
        ...(softness !== undefined ? { softness } : {}),
        ...(specular && Math.max(...specular) > 0 ? { specular } : {}),
      };
    }),
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
 * Whether any of the lights added to a body (or its shadow, set to light instead) lights it, not
 * darkens it.
 */
export function addedLighting(
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
): boolean {
  const shadow = settings?.shadow;
  return (
    onLights(added, settings).some((l) => !l.darkens) ||
    (shadow?.darkens === false && shadow.enabled !== false)
  );
}

/**
 * A body's light rig with the lights added to it, and its shadow where set to light instead
 * (`shade`): their light from all round added to its ambient, their directional lights after its
 * own. A body without a rig is lit by them alone (at the scene's exposure); none at all: unlit.
 * Those that darken are apart (`bodyDarkenings`).
 */
export function withAddedLights(
  light: PlanetLight | undefined,
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
  exposure: number,
  shade?: BodyShade,
): PlanetLight | undefined {
  const shadow = shade
    ? bodyLights(undefined, shade, settings).filter((l) => l.enabled && !l.darkens)
    : [];
  const on = [...shadow, ...onLights(added, settings).filter((l) => !l.darkens)];
  if (!on.length) return light;
  const base: PlanetLight = light ?? { ambient: [0, 0, 0], directional: [], exposure };
  const ambient = on
    .filter((l) => l.kind === 'ambient')
    .reduce((sum, l) => {
      const c = rgbOf(l.colour, l.strength);
      return [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]] as const;
    }, base.ambient);
  const directional = on.flatMap((l) => {
    const placed = placedLight(l);
    return placed ? [placed] : [];
  });
  return { ...base, ambient, directional: [...base.directional, ...directional] };
}

/**
 * What darkens a body: from a side (`direction`, the way the light comes from; none: all round),
 * how strongly, how softly round the body, and the colour it takes away (each channel 0 to 1).
 */
export interface Darkening {
  readonly direction?: Vec3;
  readonly strength: number;
  readonly softness: number;
  readonly colour: Vec3;
  /** From a point, a spot, above and below, the sky round the body, or the rim (see `PlanetDirectionalLight`); none: from a side, or all round. */
  readonly kind?: 'point' | 'spot' | 'hemisphere' | 'environment' | 'rim';
  readonly position?: Vec3;
  readonly fade?: number;
  readonly aim?: Vec3;
  readonly cone?: number;
  readonly edge?: number;
  readonly wrap?: number;
}

/**
 * The lights that darken a body, on and of some strength: its rig's and its shadow (`shade`), as
 * set, then those added to it.
 */
export function bodyDarkenings(
  light: PlanetLight | undefined,
  shade: BodyShade,
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
): Darkening[] {
  return [...bodyLights(light, shade, settings), ...onLights(added, settings)]
    .filter((l) => l.enabled && l.darkens && l.strength > 0)
    .map((l) => {
      const placed = l.kind === 'ambient' || l.kind === 'directional' ? undefined : placedLight(l);
      return {
        ...(l.from ? { direction: l.from } : {}),
        strength: l.strength,
        softness: l.softness ?? 1,
        colour: rgbOf(l.colour, 1),
        ...(l.wrap !== undefined ? { wrap: l.wrap } : {}),
        ...(placed?.kind
          ? {
              kind: placed.kind,
              position: placed.position,
              fade: placed.fade,
              aim: placed.aim,
              cone: placed.cone,
              edge: placed.edge,
            }
          : {}),
      };
    });
}
