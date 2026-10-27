import { overlayOn, wornKey } from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  type BodySettings,
  type BodyValues,
  DEFAULT_ORBIT,
  HALO_MARGIN,
  type MoonChoices,
  type Orbit,
  ORBIT_KEYS,
  type Vec3,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { Variant } from '@myrddraall/heroes-replay-stats-aether/variants';
import {
  DEFAULT_SHADE,
  type PlanetFile,
  poleOf,
  wearOf,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  type MaterialSettingsMap,
  type MaterialTint,
  NO_MATERIAL_TINT,
  originsOf,
  type SettingOrigins,
} from '@myrddraall/heroes-replay-stats-aether/materials';
import {
  DEFAULT_ORIENTATION,
  keyLightFrom,
  NO_QUAT,
  type Orientation,
  TOWARDS_EYE,
} from '@myrddraall/heroes-replay-stats-aether/space';
/**
 * A body as an editor of the design shows it, whichever layer it edits (a scene, over the library;
 * the library, over the game data): its values through the layers, and what is set in the layer
 * edited.
 */

/** What a tree row is, for the properties shown when it is selected. */
export type TargetKind =
  | 'scene'
  | 'sky'
  | 'sky-material'
  | 'body'
  | 'material'
  | 'particle'
  | 'backdrop'
  | 'stand-in'
  | 'reference'
  | 'group'
  /** A group put in a scene. */
  | 'placement'
  /** A scene's cameras (their group), and one of them. */
  | 'cameras'
  | 'camera'
  | 'part'
  | 'light'
  /** What of a material a row shows: one of its layers, its shield shader, one of that's lights. */
  | 'layer'
  | 'shader'
  | 'gridLight';

/**
 * An overlay a body wears, as an editor has it: which, its settings under the layer edited (the
 * library's: the overlay's own, as it is wherever it is worn), its file once loaded.
 */
export interface WornOverlay {
  readonly id: string;
  /** Its name as made, where it was made in the editor (else its id is its name). */
  readonly name?: string;
  readonly below?: BodySettings;
  readonly file?: PlanetFile;
}

/** A level of a body's settings as an editor names it (as its origins say it) and what it sets. */
export interface SettingsLevel {
  readonly name: string;
  readonly settings: BodySettings | undefined;
}

/**
 * A body as an editor has it: which planet (or overlay), the overlays it wears, its settings in
 * the layer edited and those under it, its files once loaded.
 */
export interface BodyInfo {
  /** How the editor names it (its row's key). */
  readonly key: string;
  readonly id: string;
  /** Its name as made, where it is an overlay made in the editor (else its id is its name). */
  readonly name?: string;
  /** The overlays it wears, the later over the earlier. */
  readonly overlays: readonly WornOverlay[];
  /** Whether what it wears is chosen in the layer edited (else what is under it). */
  readonly overlaysSet: boolean;
  /** Its settings in the layer edited. */
  readonly settings: BodySettings;
  /** Its own defaults, under the layer edited (the library's, under a scene). */
  readonly below?: BodySettings;
  /**
   * Its variants that are on under the level edited, the lowest first: a scene's planet, all of
   * them; one of its variants edited, its data's settings for it and those on before it.
   */
  readonly variantsBelow?: readonly SettingsLevel[];
  /**
   * What is set over the level edited, the lowest first (the planet open: its variants on, those
   * after one edited): what wins over what is set there.
   */
  readonly above?: readonly SettingsLevel[];
  /** Its own variants (its data's, then the library's), where it is a planet. */
  readonly variants?: readonly Variant[];
  /** Which of its variants are on where it is (a scene's body: as the scene and its variants have them). */
  readonly variantsOn?: readonly string[];
  /** The materials' base settings (the library's), under its own. */
  readonly materialBase?: MaterialSettingsMap;
  readonly file?: PlanetFile;
  /** Its orbit, where it is a moon in a scene. */
  readonly orbit?: Orbit;
  /** Where it is and how big, where it is one of a scene's planets. */
  readonly place?: { readonly position: Vec3; readonly radius: number };
  readonly moons: readonly MoonChoices[];
  /** One of its planet's own moons (the library's): as the planet has it, under what the scene sets. */
  readonly inherited?: MoonChoices;
}

/** A body as its properties show it. */
export interface BodyView {
  readonly info: BodyInfo;
  readonly values: BodyValues;
  /** Whether anything of it is set in the layer edited. */
  readonly changed: boolean;
  /** Its tint under the layer edited. */
  readonly baseTint: MaterialTint;
  readonly focused: boolean;
  /** Whether moons can be put about it (a scene's bodies, but for its planets' own moons). */
  readonly canHaveMoons: boolean;
  /** Whether it is one of its planet's own moons (switched off in a scene, never taken out). */
  readonly inherited: boolean;
  /** Its orbit under the level edited: its planet's for its own moon, else a new moon's. */
  readonly orbitBase: Orbit;
  /** Whether its lights are set here (a library planet's own moon's are its own planet's: not here). */
  readonly lights: boolean;
  /** Whether the overlays it wears are chosen here (a scene's bodies, a library planet's own moons). */
  readonly styled: boolean;
  /** Whether the view can be centred on it (a scene's moons). */
  readonly focusable: boolean;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof BodySettings>;
  /** Which level over the one edited wins for each of its settings, where one sets it (see `BodyInfo.above`). */
  readonly overrides: SettingOrigins<keyof BodySettings>;
  /** Its name as shown, and as the levels under the one edited have it. */
  readonly label: string;
  readonly labelBelow: string;
}

/** The ids of the overlays a body wears. */
export const wornIds = (b: BodyInfo) => b.overlays.map((o) => o.id);

/** The key a body's settings are kept by for what it wears (see `wornKey`). */
export const wornKeyOf = (b: BodyInfo) => wornKey(wornIds(b));

/** An overlay's name: as renamed in the library, else its id. */
export const overlayLabel = (o: WornOverlay) => o.below?.label ?? o.name ?? o.id;

/** The last of some values that is set (the later over the earlier). */
const latest = <T>(values: readonly (T | undefined)[]): T | undefined =>
  values.filter((v) => v !== undefined).at(-1);

/**
 * A body's own levels under the level edited, the lowest first: its own defaults (the library's),
 * then its variants on under it (over the overlays it wears, which are shared).
 */
export const ownLevels = (b: BodyInfo): readonly SettingsLevel[] => [
  { name: 'the library (planet)', settings: b.below },
  ...(b.variantsBelow ?? []),
];

/** A setting as the nearest of a body's own levels under the level edited sets it. */
export const ownSetting = <K extends keyof BodySettings>(b: BodyInfo, k: K): BodySettings[K] =>
  latest(ownLevels(b).map((l) => l.settings?.[k]));

/** A body's own levels under the level edited, the nearest first (as `overlayOn` reads levels). */
const ownNearestFirst = (b: BodyInfo) => [...ownLevels(b)].reverse().map((l) => l.settings);

/**
 * Which level over the one edited wins for each of a body's settings, where one sets it (the
 * topmost), by `pick`: what of each level is weighed (its settings, one material's, one part's).
 */
export function overridesOf<T>(
  b: BodyInfo,
  pick: (s: BodySettings | undefined) => T | undefined,
): SettingOrigins<keyof T & string> {
  return originsOf((b.above ?? []).map((l) => [l.name, pick(l.settings)] as const));
}

/** The light a body is lit by: its overlays' (the first of them that has one), else its own. */
export const rigOf = (b: BodyInfo) =>
  b.overlays.find((o) => o.file?.light)?.file?.light ?? b.file?.light;

/** How a body's overlays shade it, each setting the later's over the earlier's. */
function overlayShades(b: BodyInfo) {
  const wear = (o: WornOverlay) => wearOf(b.file, o.id)?.shade;
  return {
    strength: {
      styled: latest(b.overlays.map((o) => o.below?.shade)),
      wear: latest(b.overlays.map((o) => wear(o)?.strength)),
      style: latest(b.overlays.map((o) => o.file?.shade?.strength)),
    },
    direction: {
      styled: latest(b.overlays.map((o) => o.below?.shadeTowards)),
      wear: latest(b.overlays.map((o) => wear(o)?.direction)),
      style: latest(b.overlays.map((o) => o.file?.shade?.direction)),
    },
  };
}

/** The overlays a body wears that are drawn (those switched off set nothing), the later over the earlier. */
export const drawnOverlays = (b: BodyInfo) =>
  b.overlays.filter((o) => overlayOn(o.id, b.settings, ...ownNearestFirst(b)) !== false);

/**
 * A setting of a body as its levels stack, where one sets it: the layer edited, over its own
 * levels (its variants on under it, its own defaults), over what the overlays it wears set
 * (shared: the later over the earlier).
 */
export function stackedSetting<K extends keyof BodySettings>(b: BodyInfo, k: K): BodySettings[K] {
  return b.settings[k] ?? ownSetting(b, k) ?? latest(drawnOverlays(b).map((o) => o.below?.[k]));
}

/** A body's own settings as shown: the layer edited, over those under it (its overlays' shade over its own), over its files' tuning, over the defaults. */
export function valuesOf(b: BodyInfo): BodyValues {
  const tuning = b.file?.tuning;
  const s = b.settings;
  const { strength, direction } = overlayShades(b);
  const at = <K extends keyof BodySettings>(k: K) => stackedSetting(b, k);
  return {
    overlays: wornIds(b),
    lighting: at('lighting') ?? tuning?.lighting ?? 1,
    // Its own shade, else as an overlay it wears shades it (as it wears it).
    shade:
      s.shade ??
      ownSetting(b, 'shade') ??
      strength.styled ??
      strength.wear ??
      strength.style ??
      tuning?.shade?.strength ??
      DEFAULT_SHADE.strength,
    tint: at('tint') ?? tuning?.tint ?? NO_MATERIAL_TINT,
    lightFrom: at('lightFrom') ?? tuning?.lightFrom ?? keyLightFrom(rigOf(b)),
    shadeTowards:
      s.shadeTowards ??
      ownSetting(b, 'shadeTowards') ??
      direction.styled ??
      direction.wear ??
      direction.style ??
      tuning?.shade?.direction ??
      DEFAULT_SHADE.direction,
    rim: at('rim') ?? tuning?.rim ?? TOWARDS_EYE,
    glowMargin: at('glowMargin') ?? HALO_MARGIN,
    orientation: bodyOrientation(b),
    // As its data has them unless set: its textures' pole, no turn about it.
    axis: at('axis') ?? tuning?.axis ?? poleOf(b.file?.parts ?? []),
    turn: at('turn') ?? tuning?.turn ?? 0,
    baseTurn: at('baseTurn') ?? tuning?.baseTurn ?? NO_QUAT,
  };
}

/** Which way a body's surfaces are turned where its parts and materials don't say, where any of its levels says: as they stack (see `stackedSetting`), its tuning. */
export const bodySays = (b: BodyInfo): Orientation | undefined =>
  stackedSetting(b, 'orientation') ?? b.file?.tuning?.orientation;

/** That, else facing the camera. */
export const bodyOrientation = (b: BodyInfo): Orientation => bodySays(b) ?? DEFAULT_ORIENTATION;

/** Whether a body is drawn (a scene's; its moons with it). */
/** Whether a body is drawn: as set at the level edited, else under it (a planet's own moon may be off there). */
export const bodyEnabled = (b: BodyInfo) => b.settings.enabled ?? b.below?.enabled ?? true;

/** Whether an overlay a body wears is drawn, as set and under the level edited. */
export const overlayEnabled = (b: BodyInfo, id: string) =>
  overlayOn(id, b.settings) ?? overlayEnabledBelow(b, id);

export const overlayEnabledBelow = (b: BodyInfo, id: string) =>
  overlayOn(id, ...ownNearestFirst(b)) ?? true;

/** Whether a body's files are loaded (its overlays' too). */
export const filesLoaded = (b: BodyInfo) => !!b.file && b.overlays.every((o) => !!o.file);

/**
 * Which level under the one edited sets each of a body's settings, as `valuesOf` resolves them:
 * the first that sets it, from the nearest down (a style it wears over its own, as it shades).
 */
export function bodyOrigins(b: BodyInfo): SettingOrigins<keyof BodySettings> {
  const tuning = b.file?.tuning;
  const first = (...levels: [string, unknown][]) => levels.find(([, v]) => v !== undefined)?.[0];
  // Its own levels, the nearest first: its variants on under the level edited, its own defaults.
  const mine = (k: keyof BodySettings) =>
    [...ownLevels(b)].reverse().map((l): [string, unknown] => [l.name, l.settings?.[k]]);
  // Each overlay's say, the later's first (as it shades over the earlier's).
  const latestFirst = [...b.overlays].reverse();
  const libraryStyle = (k: 'shade' | 'shadeTowards') =>
    latestFirst.map((o): [string, unknown] => [`the library (${overlayLabel(o)})`, o.below?.[k]]);
  const worn = (k: 'strength' | 'direction') =>
    latestFirst.map((o): [string, unknown] => [
      `its tuning for ${overlayLabel(o)}`,
      wearOf(b.file, o.id)?.shade?.[k],
    ]);
  const styleOwn = (k: 'strength' | 'direction') =>
    latestFirst.map((o): [string, unknown] => [
      `the ${overlayLabel(o)} overlay`,
      o.file?.shade?.[k],
    ]);
  // Its own levels, then what the overlays it wears set (those drawn, the later first).
  const drawnLatestFirst = [...drawnOverlays(b)].reverse();
  const stack = (k: keyof BodySettings): [string, unknown][] => [
    ...mine(k),
    ...drawnLatestFirst.map((o): [string, unknown] => [
      `the ${overlayLabel(o)} overlay`,
      o.below?.[k],
    ]),
  ];
  const out: SettingOrigins<keyof BodySettings> = {
    lighting: first(...stack('lighting'), ['its tuning', tuning?.lighting]),
    shade: first(
      ...mine('shade'),
      ...libraryStyle('shade'),
      ...worn('strength'),
      ...styleOwn('strength'),
      ['its tuning', tuning?.shade?.strength],
    ),
    tint: first(...stack('tint'), ['its tuning', tuning?.tint]),
    lightFrom: first(...stack('lightFrom'), ['its tuning', tuning?.lightFrom]),
    shadeTowards: first(
      ...mine('shadeTowards'),
      ...libraryStyle('shadeTowards'),
      ...worn('direction'),
      ...styleOwn('direction'),
      ['its tuning', tuning?.shade?.direction],
    ),
    rim: first(...stack('rim'), ['its tuning', tuning?.rim]),
    glowMargin: first(...stack('glowMargin')),
    orientation: first(...stack('orientation'), ['its tuning', tuning?.orientation]),
    axis: first(...stack('axis'), ['its tuning', tuning?.axis]),
    turn: first(...stack('turn'), ['its tuning', tuning?.turn]),
    baseTurn: first(...stack('baseTurn'), ['its tuning', tuning?.baseTurn]),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as SettingOrigins<
    keyof BodySettings
  >;
}

/** A body as its properties show it, for an editor. */
export function bodyView(
  b: BodyInfo,
  focused: boolean,
  canHaveMoons: boolean,
  /** One of a library planet's own moons, edited there: its orbit and what it wears; its lights its own planet's. */
  libraryMoon = false,
): BodyView {
  return {
    info: b,
    values: valuesOf(b),
    changed: Object.keys(b.settings).length > 0 || inheritedChanged(b),
    inherited: !!b.inherited,
    orbitBase: b.inherited?.orbit ?? DEFAULT_ORBIT,
    lights: !libraryMoon,
    styled: canHaveMoons || libraryMoon,
    focusable: !libraryMoon,
    baseTint: ownSetting(b, 'tint') ?? b.file?.tuning?.tint ?? NO_MATERIAL_TINT,
    overrides: overridesOf(b, (s) => s),
    focused,
    canHaveMoons,
    origins: {
      ...bodyOrigins(b),
      label: b.below?.label !== undefined ? 'the library (planet)' : undefined,
    },
    label: bodyLabel(b),
    labelBelow: bodyLabelBelow(b),
  };
}

/** Whether a scene sets one of its planet's own moons otherwise than the planet has it: its orbit, what it wears. */
function inheritedChanged(b: BodyInfo): boolean {
  const base = b.inherited;
  if (!base || !b.orbit) return false;
  const worn = b.overlaysSet ? b.overlays.map((o) => o.id) : undefined;
  const base_ = base.overlays;
  const wears =
    worn !== undefined &&
    (worn.length !== (base_?.length ?? -1) || worn.some((id, i) => id !== base_?.[i]));
  return wears || ORBIT_KEYS.some((k) => b.orbit![k] !== base.orbit[k]);
}

/** A body's name as shown: as renamed (the level edited's, else the library's), else its id. */
export const bodyLabel = (b: BodyInfo) => b.settings.label ?? bodyLabelBelow(b);

export const bodyLabelBelow = (b: BodyInfo) => b.below?.label ?? b.name ?? b.id;
