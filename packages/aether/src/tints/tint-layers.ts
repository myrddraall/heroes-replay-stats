import type { TintBlend } from './tints';

/**
 * An object's tints (a material's, a body's over all its materials, the sky's over all of it): an
 * ordered list, each recolouring what the ones before it left, as an image editor's adjustment
 * layers do. Each level an object is set at (an overlay, the library, a variant, a scene) adds its
 * own after the ones under it, and switches any of them off or on by id (`tintsEnabled`): its own
 * too, so one switch says whether a tint is drawn wherever it was added.
 */

/**
 * What a tint does: blends a colour over (as its blend says), shifts hue, saturation and lightness,
 * or maps brightness to a gradient. A scene's grading has more (`GRADE_KINDS`): white balance,
 * brightness and contrast, lift/gamma/gain, levels, and a colour of the app's theme.
 */
export type TintKind =
  | 'colour'
  | 'hsl'
  | 'gradient'
  | 'white-balance'
  | 'brightness-contrast'
  | 'lift-gamma-gain'
  | 'levels'
  | 'theme';

/** The kinds an object's tints are (a planet's, a material's, the sky's). */
export const OBJECT_TINT_KINDS: readonly TintKind[] = ['colour', 'hsl', 'gradient'];

/**
 * The kinds a scene's grading is, in the order they are offered: those on the light (graded in HDR,
 * before tone mapping: `onLight`), then those on the picture shown.
 */
export const GRADE_KINDS: readonly TintKind[] = [
  'white-balance',
  'brightness-contrast',
  'lift-gamma-gain',
  'colour',
  'hsl',
  'gradient',
  'levels',
  'theme',
];

/**
 * Whether a grading tint of a kind acts on the light, before it is tone mapped (white balance,
 * brightness and contrast, lift/gamma/gain: HDR values taken as they are); the rest act on the
 * picture as shown (0 to 1), where blends are defined.
 */
export const onLight = (kind: TintKind) =>
  kind === 'white-balance' || kind === 'brightness-contrast' || kind === 'lift-gamma-gain';

/** When a tint recolours: the surface before it is lit (the lights shade the new colour), or the colour as lit. */
export type TintStage = 'surface' | 'result';

/** The material layers a tint can be masked by (a body's tint: each of its materials by its own). */
export type TintMaskLayer = 'diffuse' | 'emissive' | 'mask1' | 'mask2';

/** Which of a layer's channels a mask reads: one of its colours, its alpha, or its brightness. */
export type TintMaskChannel = 'r' | 'g' | 'b' | 'a' | 'luma';

/**
 * Where a tint is on (0 to 1): by a channel of one of its material's layers, or by how far the
 * surface turns from the eye (0 facing it, 1 at the edge: on from `from`, all on at `to`); either
 * the other way round where `invert`.
 */
export type TintMask =
  | {
      readonly by: 'layer';
      readonly layer: TintMaskLayer;
      readonly channel: TintMaskChannel;
      readonly invert?: boolean;
    }
  | {
      readonly by: 'facing';
      readonly from: number;
      readonly to: number;
      readonly invert?: boolean;
    };

/** A gradient's colour at a brightness (0 to 1). */
export interface GradientStop {
  readonly at: number;
  /** `#rrggbb`. */
  readonly colour: string;
}

interface TintBase {
  /** Its own, unique among an object's tints at every level. */
  readonly id: string;
  /** How it is named in the editor, where it is given one. */
  readonly name?: string;
  /** How much of it shows (0 none, 1 all of it). */
  readonly strength: number;
  /** When it recolours (unset: `result`). */
  readonly stage?: TintStage;
  /** Where it is on (unset: everywhere). */
  readonly mask?: TintMask;
}

/** A colour blended over, as CSS's blend modes of that name do (a colour past white keeps its brightness). */
export interface ColourTint extends TintBase {
  readonly kind: 'colour';
  /** `#rrggbb`. */
  readonly colour: string;
  readonly blend: TintBlend;
}

/** Hue turned (degrees), saturation and lightness moved (-1 to 1: none left, as is, all the way). */
export interface HslTint extends TintBase {
  readonly kind: 'hsl';
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

/** Brightness mapped to a gradient: black to the first stop, white to the last (2 to `MAX_STOPS`). */
export interface GradientTint extends TintBase {
  readonly kind: 'gradient';
  readonly stops: readonly GradientStop[];
}

/**
 * White balance as a photo editor sets it: `temperature` the light's (kelvin; 6500 as it is), the
 * picture turned the other way (a warmer light corrected: cooler); `tint` -1 green to 1 magenta.
 */
export interface WhiteBalanceTint extends TintBase {
  readonly kind: 'white-balance';
  readonly temperature: number;
  readonly tint: number;
}

/** Brightness in stops (0 as it is), and contrast about mid grey (1 as it is). */
export interface BrightnessContrastTint extends TintBase {
  readonly kind: 'brightness-contrast';
  readonly brightness: number;
  readonly contrast: number;
}

/**
 * One of lift/gamma/gain's ranges: how much (`amount`) and toward what colour (`#rrggbb`, white:
 * none; its brightness taken out, so a colour leans it without brightening it).
 */
export interface ToneRange {
  readonly colour: string;
  readonly amount: number;
}

/**
 * Lift (added: the darks, 0 as it is), gamma (the midtones, 1 as it is) and gain (multiplied: the
 * highlights, 1 as it is), as ASC CDL's offset, power and slope have them.
 */
export interface LiftGammaGainTint extends TintBase {
  readonly kind: 'lift-gamma-gain';
  readonly lift: ToneRange;
  readonly gamma: ToneRange;
  readonly gain: ToneRange;
}

/**
 * Levels, as an image editor's (and the game's colorization) have them: the input range stretched
 * to the output range, its midtones by `gamma` (1 as it is).
 */
export interface LevelsTint extends TintBase {
  readonly kind: 'levels';
  readonly inputLow: number;
  readonly inputHigh: number;
  readonly gamma: number;
  readonly outputLow: number;
  readonly outputHigh: number;
}

/** A colour of the app's theme blended over, as one of its tint presets has it (by id). */
export interface ThemeTint extends TintBase {
  readonly kind: 'theme';
  readonly preset: string;
}

export type TintLayer =
  | ColourTint
  | HslTint
  | GradientTint
  | WhiteBalanceTint
  | BrightnessContrastTint
  | LiftGammaGainTint
  | LevelsTint
  | ThemeTint;

/** Whether each tint is drawn, by id, as a level says (unset: drawn). */
export type TintSwitches = Readonly<Record<string, boolean>>;

/** What of an object's settings its tints are: its own list, and its switches. */
export interface TintsSet {
  readonly tints?: readonly TintLayer[];
  readonly tintsEnabled?: TintSwitches;
}

/** How many stops a gradient tint has at most. */
export const MAX_STOPS = 4;

/** The tints of an object's levels, the lowest first: their lists joined, their switches the nearer over the further. */
export function stackedTints(...levels: readonly (TintsSet | undefined)[]): TintsSet {
  const tints = levels.flatMap((l) => l?.tints ?? []);
  const switches = levels.reduce<Record<string, boolean>>(
    (out, l) => ({ ...out, ...l?.tintsEnabled }),
    {},
  );
  return {
    ...(tints.length ? { tints } : {}),
    ...(Object.keys(switches).length ? { tintsEnabled: switches } : {}),
  };
}

/**
 * The tints drawn of an object's, in order: those switched off left out (and any not of an
 * object's kinds), as many as a draw takes.
 */
export function drawnTints(set: TintsSet | undefined, max: number): readonly TintLayer[] {
  return switchedOn(set)
    .filter((t) => OBJECT_TINT_KINDS.includes(t.kind))
    .slice(0, max);
}

/** The tints of a set switched on, in order. */
export const switchedOn = (set: TintsSet | undefined): readonly TintLayer[] =>
  (set?.tints ?? []).filter((t) => set?.tintsEnabled?.[t.id] !== false);

/** A neutral lift/gamma/gain range (white, by `amount`). */
const neutral = (amount: number): ToneRange => ({ colour: '#ffffff', amount });

/**
 * A new tint of a kind, its id not among `ids`, as it is: a colour multiplied by white, no shift,
 * black to white, and the rest at their neutral settings (a theme's colour: `theme`'s preset).
 */
export function newTint(kind: TintKind, ids: readonly string[], theme = ''): TintLayer {
  let n = 1;
  while (ids.includes(`tint-${n}`)) n++;
  const id = `tint-${n}`;
  switch (kind) {
    case 'colour':
      return { id, kind, strength: 1, colour: '#ffffff', blend: 'multiply' };
    case 'hsl':
      return { id, kind, strength: 1, hue: 0, saturation: 0, lightness: 0 };
    case 'gradient':
      return {
        id,
        kind,
        strength: 1,
        stops: [
          { at: 0, colour: '#000000' },
          { at: 1, colour: '#ffffff' },
        ],
      };
    case 'white-balance':
      return { id, kind, strength: 1, temperature: 6500, tint: 0 };
    case 'brightness-contrast':
      return { id, kind, strength: 1, brightness: 0, contrast: 1 };
    case 'lift-gamma-gain':
      return { id, kind, strength: 1, lift: neutral(0), gamma: neutral(1), gain: neutral(1) };
    case 'levels':
      return {
        id,
        kind,
        strength: 1,
        inputLow: 0,
        inputHigh: 1,
        gamma: 1,
        outputLow: 0,
        outputHigh: 1,
      };
    case 'theme':
      return { id, kind, strength: 1, preset: theme };
  }
}

/** The one tint kept before objects had several (a colour, how it blends, how strongly). */
interface KeptTint {
  readonly colour: string;
  readonly blend: TintBlend;
  readonly strength: number;
}

const isKept = (t: unknown): t is KeptTint =>
  !!t &&
  typeof t === 'object' &&
  typeof (t as KeptTint).colour === 'string' &&
  typeof (t as KeptTint).blend === 'string' &&
  typeof (t as KeptTint).strength === 'number';

/** The id the one tint kept before is given in the list it becomes. */
export const KEPT_TINT = 'tint';

/**
 * A design's settings with each one tint kept before objects had several (`tint`, wherever it is)
 * read as the first of its object's list; anything else as it is.
 */
export function migrateTints<T>(value: T): T {
  if (Array.isArray(value)) {
    const items = value.map((v) => migrateTints(v));
    return (items.some((v, i) => v !== value[i]) ? items : value) as T;
  }
  if (!value || typeof value !== 'object') return value;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const migrated = migrateTints(v);
    if (migrated !== v) changed = true;
    out[k] = migrated;
  }
  const kept = out['tint'];
  if (isKept(kept)) {
    const tints = (out['tints'] as readonly TintLayer[] | undefined) ?? [];
    const first: ColourTint = {
      id: KEPT_TINT,
      kind: 'colour',
      colour: kept.colour,
      blend: kept.blend,
      strength: kept.strength,
    };
    out['tints'] = [first, ...tints.filter((t) => t.id !== KEPT_TINT)];
    delete out['tint'];
    changed = true;
  }
  return (changed ? out : value) as T;
}
