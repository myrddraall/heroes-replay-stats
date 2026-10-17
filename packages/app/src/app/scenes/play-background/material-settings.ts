import type { SceneBlend, SceneMaterial } from './play-scene';
import type { MaterialSettings, MaterialSettingsMap, MaterialTint } from './scene-planets';

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
  readonly scale: number;
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
  /** A layer with a fresnel has a floor to set. */
  readonly spread: boolean;
  /** An emissive layer has a pattern to size. */
  readonly scale: boolean;
  /** A textured emissive has a range to cut; a drawn pattern's lines are set instead. */
  readonly cut: boolean;
  /** A drawn pattern's lines have a width and a softness. */
  readonly lines: boolean;
}

/** The settings where nothing says otherwise (the spread's is the material's own, see `ownSpread`). */
export const MATERIAL_DEFAULTS = {
  enabled: true,
  strength: 1,
  glow: 1,
  scale: 1,
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
    scale: settings?.scale ?? MATERIAL_DEFAULTS.scale,
    cut: settings?.cut ?? MATERIAL_DEFAULTS.cut,
    width: settings?.width ?? MATERIAL_DEFAULTS.width,
    soft: settings?.soft ?? MATERIAL_DEFAULTS.soft,
    tint: settings?.tint ?? NO_MATERIAL_TINT,
  };
}

/** Which of a material's controls do anything: by its layers, and whether a pattern is drawn for its emissive. */
export function materialControls(material: SceneMaterial, pattern: boolean): MaterialControls {
  const layers = [material.diffuse, material.emissive, ...material.alphaMasks];
  return {
    strength: material.blend !== 'opaque',
    spread: layers.some((l) => l?.fresnel !== undefined),
    scale: material.emissive !== null || pattern,
    cut: material.emissive !== null && !pattern,
    lines: pattern,
  };
}
