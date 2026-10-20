import type { SceneBlend, SceneMaterial } from './play-scene';
import { TOWARDS_EYE, type Vec3 } from './scene-directions';
import type {
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
}

/** No tint: white, not at all. */
export const NO_MATERIAL_TINT: MaterialTint = { colour: '#ffffff', blend: 'multiply', strength: 0 };

/** Which of a material's controls do anything, by what it has. */
export interface MaterialControls {
  /** A blended material's alpha scales; an opaque one's doesn't. */
  readonly strength: boolean;
  /** A layer with a fresnel has a floor to set, and a side it spreads from. */
  readonly spread: boolean;
  /** An emissive layer has a pattern to size. */
  readonly scale: boolean;
  /** A drawn pattern can be shown as its texture instead (the game's way). */
  readonly drawAs: boolean;
  /** A textured emissive has a range to cut; a drawn pattern's lines are set instead. */
  readonly cut: boolean;
  /** A drawn pattern's lines have a width and a softness. */
  readonly lines: boolean;
  /** Drawn by a particle system: only whether it is drawn and its strength apply. */
  readonly particles: boolean;
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
 * placement's say), each setting its own: a layer that leaves one out leaves the earlier's.
 */
export function mergeMaterialSettings(
  ...layers: readonly (MaterialSettingsMap | undefined)[]
): MaterialSettingsMap {
  const out: Record<string, MaterialSettings> = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [name, settings] of Object.entries(layer)) out[name] = { ...out[name], ...settings };
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

/** A material's settings as shown: what is set, over the material's own ways, over the defaults. */
export function materialValues(
  material: SceneMaterial,
  settings: MaterialSettings | undefined,
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
  };
}

/**
 * Which of a material's controls do anything: by its layers, and whether a pattern is drawn for
 * its emissive (`pattern`: its part has one; `drawAs`: whether it is drawn or shown as its texture).
 */
export function materialControls(
  material: SceneMaterial,
  pattern: boolean,
  particles = false,
  drawAs: MaterialDrawAs = 'pattern',
): MaterialControls {
  if (particles)
    return {
      strength: true,
      spread: false,
      scale: false,
      drawAs: false,
      cut: false,
      lines: false,
      particles,
    };
  const layers = [material.diffuse, material.emissive, ...material.alphaMasks];
  const drawn = pattern && drawAs === 'pattern';
  return {
    particles,
    strength: material.blend !== 'opaque',
    spread: layers.some((l) => l?.fresnel !== undefined),
    scale: material.emissive !== null || pattern,
    drawAs: pattern && material.emissive?.texture !== undefined,
    cut: material.emissive !== null && !drawn,
    lines: drawn,
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
