import type { SceneBlend, SceneMaterial } from './play-scene';
import { TOWARDS_EYE, type Vec3 } from './scene-directions';
import type {
  LayerSlot,
  MaterialDepth,
  MaterialDrawAs,
  MaterialSettings,
  MaterialSettingsMap,
  MaterialTint,
} from './scene-planets';

/**
 * Materials' settings as the renderer and the Background page's panel read them: what a
 * material's settings come to from the layers that set them, what its controls show where
 * nothing is set, and which of its controls do anything.
 */

/** The blends a material may be given. */
export const MATERIAL_BLENDS: readonly SceneBlend[] = ['opaque', 'alpha', 'add', 'alphaAdd'];

/** A material's settings as shown: every one resolved. */
export interface MaterialValues {
  readonly enabled: boolean;
  readonly strength: number;
  readonly blend: SceneBlend;
  readonly glow: number;
  readonly spread: number;
  readonly spreadFrom: Vec3;
  readonly falloff: number;
  readonly scale: number;
  readonly drawAs: MaterialDrawAs;
  readonly cut: number;
  readonly width: number;
  readonly soft: number;
  readonly tint: MaterialTint;
  /** Where it is drawn among the scene's objects (a sky material's; a planet's are among them). */
  readonly depth: MaterialDepth;
  /** Whether its body's light lights it (else flat, as its textures have it). */
  readonly lit: boolean;
  /** A grid's colours: inactive (its own), and active (where it is activated). */
  readonly inactive: string;
  readonly active: string;
  /** A grid's reveal and activation (see `MaterialSettings`). */
  readonly revealOn: boolean;
  readonly revealStrength: number;
  readonly revealFrom: Vec3;
  readonly revealReach: number;
  readonly revealFalloff: number;
  readonly activationOn: boolean;
  readonly activationStrength: number;
  readonly activationTied: boolean;
  readonly activationFrom: Vec3;
  readonly activationReach: number;
  readonly activationFalloff: number;
  readonly activationEnergizes: number;
  readonly activationGlow: number;
}

/**
 * A grid's reveal and activation where nothing is set: revealed from the front, enough to show
 * all of its face (as the game shows a grid), its side and falloff telling once turned or
 * narrowed; activated (once switched on) the same way at half the strength, its side the
 * reveal's, energizing and glowing a little.
 */
export const GRID_DEFAULTS = {
  revealOn: true,
  revealStrength: 2,
  revealFrom: TOWARDS_EYE,
  revealReach: 1,
  revealFalloff: 1,
  activationOn: false,
  activationStrength: 1,
  activationTied: true,
  activationFrom: TOWARDS_EYE,
  activationReach: 1,
  activationFalloff: 1,
  activationEnergizes: 0.25,
  activationGlow: 0.5,
} as const;

/** A grid's reveal or activation as it is drawn: its side, reach, falloff and strength; an activation's energizing and glow. */
export interface GridField {
  readonly from: Vec3;
  readonly reach: number;
  readonly falloff: number;
  readonly strength: number;
  readonly energizes?: number;
  readonly glow?: number;
}

/** A grid's reveal and activation as drawn (none of either where switched off): an activation tied to the reveal from its side. */
export function gridFields(v: MaterialValues): {
  readonly reveal: readonly GridField[];
  readonly activation: readonly GridField[];
} {
  return {
    reveal: v.revealOn
      ? [
          {
            from: v.revealFrom,
            reach: v.revealReach,
            falloff: v.revealFalloff,
            strength: v.revealStrength,
          },
        ]
      : [],
    activation: v.activationOn
      ? [
          {
            from: v.activationTied ? v.revealFrom : v.activationFrom,
            reach: v.activationReach,
            falloff: v.activationFalloff,
            strength: v.activationStrength,
            energizes: v.activationEnergizes,
            glow: v.activationGlow,
          },
        ]
      : [],
  };
}

/** No tint: white, not at all. */
export const NO_MATERIAL_TINT: MaterialTint = { colour: '#ffffff', blend: 'multiply', strength: 0 };

/** Which of a material's controls do anything, by what it has. */
export interface MaterialControls {
  /** A blended material's alpha scales; an opaque one's doesn't. */
  readonly strength: boolean;
  /** A layer with a fresnel has a floor to set, and a side it spreads from. */
  readonly spread: boolean;
  /** A grid (a drawn pattern) has an inactive and an active colour. */
  readonly colours: boolean;
  /** An emissive layer has a pattern to size. */
  readonly scale: boolean;
  /** A drawn pattern can be shown as its texture instead (the game's way). */
  readonly drawAs: boolean;
  /** A textured emissive has a range to cut; a drawn pattern's lines are set instead. */
  readonly cut: boolean;
  /** A drawn pattern's lines have a width and a softness. */
  readonly lines: boolean;
  /** Drawn by a particle system: only whether it is drawn, its strength and its depth apply. */
  readonly particles: boolean;
  /** A sky material is drawn behind the scene's objects, among them or in front of them. */
  readonly depth: boolean;
  /** A body's material is lit by its light or flat (the sky and particles aren't lit). */
  readonly lit: boolean;
}

/** What a material is used as, for which of its controls do anything. */
export interface MaterialUseOf {
  /** Its part has a pattern drawn for its emissive. */
  readonly pattern?: boolean;
  /** A particle system draws it. */
  readonly particles?: boolean;
  /** How its pattern shows (drawn unless set). */
  readonly drawAs?: MaterialDrawAs;
  /** It is the sky's. */
  readonly sky?: boolean;
}

/** A grid's active colour where none is set: magenta (the game has none: its grids are only ever inactive). */
export const DEFAULT_ACTIVE = '#ff2bd6';

/** A material's own colour as a grid's inactive colour: its diffuse's flat colour (white where it has none). */
export function ownInactive(material: SceneMaterial): string {
  const c = material.diffuse?.texture ? undefined : material.diffuse?.color;
  if (!c) return '#ffffff';
  return `#${c
    .slice(0, 3)
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The settings where nothing says otherwise (the spread's is the material's own, see `ownSpread`). */
export const MATERIAL_DEFAULTS = {
  enabled: true,
  strength: 1,
  glow: 1,
  scale: 1,
  falloff: 2,
  cut: 0,
  width: 0.08,
  soft: 0.3,
} as const;

/**
 * Materials' settings from several layers, the later over the earlier (a planet's tuning, then a
 * placement's say), each setting its own: a layer that leaves one out leaves the earlier's (a
 * material layer's settings too, one by one).
 */
export function mergeMaterialSettings(
  ...layers: readonly (MaterialSettingsMap | undefined)[]
): MaterialSettingsMap {
  const out: Record<string, MaterialSettings> = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [name, settings] of Object.entries(layer)) {
      const before = out[name];
      // Each of its layers' settings its own too: a level setting one of a layer's leaves the rest.
      const layers =
        before?.layers && settings.layers
          ? Object.fromEntries(
              [...new Set([...Object.keys(before.layers), ...Object.keys(settings.layers)])].map(
                (slot) => {
                  const k = slot as LayerSlot;
                  return [k, { ...before.layers?.[k], ...settings.layers?.[k] }];
                },
              ),
            )
          : (settings.layers ?? before?.layers);
      out[name] = { ...before, ...settings, ...(layers ? { layers } : {}) };
    }
  }
  return out;
}

/**
 * The floor a material's fresnel layers have of their own: the highest of their minimums (a
 * layer without a fresnel has none).
 */
export function ownSpread(material: SceneMaterial): number {
  return Math.max(
    0,
    ...[material.diffuse, material.emissive, ...material.alphaMasks].map(
      (l) => l?.fresnel?.min ?? 0,
    ),
  );
}

/**
 * The side a material spreads from of its own: where its first fresnel layer is brightest, the
 * point on the face opposite where its turn leans (none turned, or none with a fresnel: straight
 * at the eye). A turn of `yaw` to the right and `pitch` upwards (negative), as `rimTurn` gives one
 * for the point it leans to.
 */
export function ownSpreadFrom(material: SceneMaterial): Vec3 {
  const f = [material.diffuse, material.emissive, ...material.alphaMasks].find(
    (l) => l?.fresnel,
  )?.fresnel;
  if (!f) return TOWARDS_EYE;
  const { yaw, pitch } = f;
  return [-Math.cos(pitch) * Math.sin(yaw), -Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch)];
}

/**
 * A material's settings as shown: what is set, over the material's own ways, over the defaults (a
 * sky material's depth its own, as `skyDepths` finds it, where given).
 */
export function materialValues(
  material: SceneMaterial,
  settings: MaterialSettings | undefined,
  ownDepth: MaterialDepth = 'background',
): MaterialValues {
  return {
    enabled: settings?.enabled ?? MATERIAL_DEFAULTS.enabled,
    strength: settings?.strength ?? MATERIAL_DEFAULTS.strength,
    blend: settings?.blend ?? material.blend,
    glow: settings?.glow ?? MATERIAL_DEFAULTS.glow,
    spread: settings?.spread ?? ownSpread(material),
    spreadFrom: settings?.spreadFrom ?? ownSpreadFrom(material),
    falloff: settings?.falloff ?? MATERIAL_DEFAULTS.falloff,
    scale: settings?.scale ?? MATERIAL_DEFAULTS.scale,
    drawAs: settings?.drawAs ?? 'pattern',
    cut: settings?.cut ?? MATERIAL_DEFAULTS.cut,
    width: settings?.width ?? MATERIAL_DEFAULTS.width,
    soft: settings?.soft ?? MATERIAL_DEFAULTS.soft,
    tint: settings?.tint ?? NO_MATERIAL_TINT,
    depth: settings?.depth ?? ownDepth,
    lit: settings?.lit ?? !material.unshaded,
    inactive: settings?.inactive ?? ownInactive(material),
    active: settings?.active ?? DEFAULT_ACTIVE,
    revealOn: settings?.revealOn ?? GRID_DEFAULTS.revealOn,
    revealStrength: settings?.revealStrength ?? GRID_DEFAULTS.revealStrength,
    revealFrom: settings?.revealFrom ?? GRID_DEFAULTS.revealFrom,
    revealReach: settings?.revealReach ?? GRID_DEFAULTS.revealReach,
    revealFalloff: settings?.revealFalloff ?? GRID_DEFAULTS.revealFalloff,
    activationOn: settings?.activationOn ?? GRID_DEFAULTS.activationOn,
    activationStrength: settings?.activationStrength ?? GRID_DEFAULTS.activationStrength,
    activationTied: settings?.activationTied ?? GRID_DEFAULTS.activationTied,
    activationFrom: settings?.activationFrom ?? GRID_DEFAULTS.activationFrom,
    activationReach: settings?.activationReach ?? GRID_DEFAULTS.activationReach,
    activationFalloff: settings?.activationFalloff ?? GRID_DEFAULTS.activationFalloff,
    activationEnergizes: settings?.activationEnergizes ?? GRID_DEFAULTS.activationEnergizes,
    activationGlow: settings?.activationGlow ?? GRID_DEFAULTS.activationGlow,
  };
}

/**
 * Which of a material's controls do anything: by its layers, and what it is used as (whether a
 * pattern is drawn for its emissive, and whether it is shown so or as its texture; whether a
 * particle system draws it; whether it is the sky's).
 */
export function materialControls(
  material: SceneMaterial,
  use: MaterialUseOf = {},
): MaterialControls {
  const { pattern = false, particles = false, drawAs = 'pattern', sky = false } = use;
  if (particles)
    return {
      strength: true,
      spread: false,
      colours: false,
      scale: false,
      drawAs: false,
      cut: false,
      lines: false,
      particles,
      depth: sky,
      lit: false,
    };
  const layers = [material.diffuse, material.emissive, ...material.alphaMasks];
  const drawn = pattern && drawAs === 'pattern';
  return {
    particles,
    strength: material.blend !== 'opaque',
    spread: layers.some((l) => l?.fresnel !== undefined),
    colours: pattern,
    scale: material.emissive !== null || pattern,
    drawAs: pattern && material.emissive?.texture !== undefined,
    cut: material.emissive !== null && !drawn,
    lines: drawn,
    depth: sky,
    lit: !sky,
  };
}

/** Where each of a thing's settings comes from: the name of the level that sets it, where one does. */
export type SettingOrigins<K extends string> = Partial<Record<K, string>>;

/**
 * Which level sets each setting, from levels in order (the later over the earlier, as they
 * merge): its name, for the last level that sets it.
 */
export function originsOf<K extends string>(
  levels: readonly (readonly [string, Partial<Record<K, unknown>> | undefined])[],
): SettingOrigins<K> {
  const out: Partial<Record<K, string>> = {};
  for (const [name, values] of levels)
    if (values)
      for (const [key, value] of Object.entries(values) as [K, unknown][])
        if (value !== undefined) out[key] = name;
  return out;
}
