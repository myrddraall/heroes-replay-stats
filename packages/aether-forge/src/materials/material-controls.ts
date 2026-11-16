import type { MaterialDrawAs } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { SceneBlend, SceneMaterial } from '@myrddraall/heroes-replay-stats-aether/formats';
/** A material's controls as its panel offers them: the blends it may be given, and which of its controls do anything. */

/** The blends a material may be given. */
export const MATERIAL_BLENDS: readonly SceneBlend[] = ['opaque', 'alpha', 'add', 'alphaAdd'];

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
  /** A sky material is anchored against the camera. */
  readonly anchor: boolean;
  /** A body's material is lit by its light or flat (the sky and particles aren't lit). */
  readonly lit: boolean;
  /** A body's material with a specular layer shines where its lights' specular says. */
  readonly specular: boolean;
  /** A body's material is turned facing the camera or fixed in the world (the sky and particles aren't). */
  readonly orientation: boolean;
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
      anchor: sky,
      lit: false,
      specular: false,
      orientation: false,
    };
  const layers = [material.diffuse, material.emissive, ...material.alphaMasks];
  const drawn = pattern && drawAs === 'pattern';
  return {
    particles,
    strength: material.blend !== 'opaque',
    // (A grid's rim is one of its lights: no Rim section of its own.)
    spread: layers.some((l) => l?.fresnel !== undefined) && !pattern,
    colours: pattern,
    scale: material.emissive !== null || pattern,
    drawAs: pattern && material.emissive?.texture !== undefined,
    cut: material.emissive !== null && !drawn,
    lines: drawn,
    depth: sky,
    anchor: sky,
    // (A grid is an unlit energy field: its own lights say where it shows.)
    lit: !sky && !pattern,
    specular: !sky && !pattern && material.specular !== undefined,
    orientation: !sky,
  };
}
