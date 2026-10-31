import type { SceneColor, SceneMaterial, SceneTexture } from './play-scene';
import type { Orientation, Quat } from '../space/graph';
import type { PartMapping, PartRole, PartShape } from './part-shapes';
import type { MaterialSettingsMap } from '../materials/material-settings';
import type { TintLayer, TintSwitches } from '../tints/tint-layers';
import type { Vec3 } from '../space/vectors';
import type { BodyVariant } from '../bodies/body-settings';

/**
 * The planets heroes-capture exports beside the Play screen's scene (`heroes-capture ui
 * background`, planets/), for the background to put up in sets of its own: the Play screen's
 * three, and the tutorial flyby's worlds and painted spheres. A planet is a body of parts, each a
 * shape about its centre (a sphere, seen from outside or from inside; a flat ring) in units of the
 * body's radius, mapped to its materials' textures by a rule, in the body's own frame: x to the
 * right, y away from the eye, z up, which the background turns to face its camera, as the game's
 * billboards do. The renderer draws each part on one camera-facing square, finding the shape under
 * each pixel: no mesh is loaded.
 */

/**
 * Which the planet is: the Play screen's own, a flyby world, or a painted sphere; or a style, parts
 * to put about any planet's body (the nexus style: the Play screen's hex-grid shield and ring,
 * and a light that shades the body as the Play screen paints its own).
 */
export type PlanetKind = 'play' | 'world' | 'painted' | 'style';

export interface PlanetIndexEntry {
  readonly id: string;
  readonly kind: PlanetKind;
  /** The style it wears unless a scene says otherwise (its tuning's). */
  readonly style?: string;
  /** Its own variants as its data has them (see `variantsOf`). */
  readonly variants?: readonly BodyVariant[];
  /**
   * Whether each overlay it wears is drawn, by the overlay's id, unless a level over its data says
   * (off: one of its variants may switch it on); unset: drawn.
   */
  readonly overlaysEnabled?: Readonly<Record<string, boolean>>;
}

/** One of the Play screen's own planets where the game puts it, at its body's radius there. */
export interface PlayPlacement {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
  /** Its variants on there (the game's look: lit as the Play screen paints it). */
  readonly variantsOn?: readonly string[];
}

export interface PlanetIndex {
  readonly planets: readonly PlanetIndexEntry[];
  /** The Play screen's own set. */
  readonly play: readonly PlayPlacement[];
  /** The styles there are (files `style-<id>`). */
  readonly styles: readonly { readonly id: string }[];
}

/**
 * A directional light: the way it travels, and its colour (times its multiplier). Or, by `kind`,
 * a light from a point near the body (where it is, in the body's frame and radii; `fade`: how
 * far it reaches, fading to nothing there, half as strong a fifth of the way), a spot (that, pointing `aim`, within a cone of `cone`
 * degrees fading over `edge` of it), a hemisphere (its colour from the side `direction` comes
 * from, `ground` from the other), the sky round the body (an environment light: the sky's
 * colours read `fade` radii out from the body's edge, each side lit by the sky beyond it, its
 * colour over them; `direction` is unused), or the rim (its colour where the surface turns away
 * from the eye, leaned by `aim` (yaw, pitch), spread `fade` of the way in, to its softness). One
 * from a side, a point or a spot wraps `wrap` of the way round (0: the half facing it).
 */
export interface PlanetDirectionalLight {
  readonly direction: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  /** How softly it falls off round the body: the power of how squarely it faces it (1: as the game lights). */
  readonly softness?: number;
  /** Its shine on a material that has a specular layer: its specular colour times its multiplier (none: none). */
  readonly specular?: readonly [number, number, number];
  readonly kind?: 'point' | 'spot' | 'hemisphere' | 'environment' | 'rim';
  readonly wrap?: number;
  readonly position?: readonly [number, number, number];
  readonly fade?: number;
  readonly aim?: readonly [number, number, number];
  readonly cone?: number;
  readonly edge?: number;
  readonly ground?: readonly [number, number, number];
}

/**
 * How a planet is lit, in its own frame, as the flyby lights it: an ambient colour, directional
 * lights, and the exposure the flyby showed it at (the background scales what it lights by this
 * over its own exposure, so the planet is as bright as the tutorial showed it).
 */
export interface PlanetLight {
  readonly ambient: readonly [number, number, number];
  readonly directional: readonly PlanetDirectionalLight[];
  readonly exposure: number;
  /** What the light's HDR blooms, where it is lower than the scene's: the planet glows past it. */
  readonly bloomThreshold?: number;
}

/**
 * A pattern the renderer draws in place of a part's emissive texture: hexes, as lines on the
 * part's mapping (so many round it, of a width and with a soft glow about them, set by its
 * materials' settings: scale, width and soft), crisp at any size.
 */
export interface PartPattern {
  readonly kind: 'hex';
  /**
   * The hexes across one tile of the texture it stands for (counted in it): drawn as many round
   * the part as the texture's tiling makes them, so its size 1 is the texture's. Without it, a
   * set number round (the renderer's own).
   */
  readonly across?: number;
}

export interface BodyPart {
  /** Which of its owner's parts it is, where its role doesn't say (an overlay's made in the editor). */
  readonly id?: string;
  readonly role: PartRole;
  readonly shape: PartShape;
  /** A pattern drawn in place of its materials' emissive texture. */
  readonly pattern?: PartPattern;
  readonly mapping: PartMapping;
  /** The mesh's second texture coordinates, where a layer reads them and a rule fits them. */
  readonly mapping2?: PartMapping;
  /** The materials drawn on it, in order (a composite material's sections). */
  readonly materials: readonly string[];
  /** The vertex colour the materials that use one multiply by. */
  readonly color?: SceneColor;
}

/**
 * Where a body's textures' poles are as its data has them, in its frame: its surface's uv
 * sphere's pole (else the first uv sphere's of its parts); straight up where it has none. Its
 * Axis is this unless set (see `bodyTurn`).
 */
export function poleOf(parts: readonly BodyPart[]): Vec3 {
  const sphere = (p: BodyPart) => p.mapping.kind === 'sphere';
  const part = parts.find((p) => p.role === 'surface' && sphere(p)) ?? parts.find(sphere);
  return part?.mapping.kind === 'sphere' ? part.mapping.pole : [0, 0, 1];
}

/**
 * Whether a part is a halo about its body, by its data: what the game draws to be seen round the
 * body's outline from the eye, never turned with the body. A ring (a flat ring in the plane facing
 * the eye, lying on the limb: the nexus style's atmosphere), a sphere seen from its far side (an
 * atmosphere shell, showing past the limb), or a part all of whose materials are an unshaded glow
 * added over what is behind it (blend add or alphaAdd: the nexus style's shield, Korhal's edge
 * light). It faces the camera square on unless its part or its material says otherwise (see
 * `drawTurnOf`).
 */
export function haloLike(
  part: BodyPart,
  materials: Readonly<Record<string, SceneMaterial>>,
): boolean {
  const { shape } = part;
  if (shape.kind === 'ring' || (shape.kind === 'sphere' && shape.side === 'far')) return true;
  const own = part.materials.map((m) => materials[m]);
  return (
    own.length > 0 &&
    own.every((m) => !!m && m.unshaded && (m.blend === 'add' || m.blend === 'alphaAdd'))
  );
}

/**
 * A darkening of a body from a side, apart from its lights: where the surface faces `direction`
 * (in the body's frame) its colour is cut by `strength` (0 to 1), coming on as the facing to the
 * power `softness` (1: as a light would; higher: more gradually). Its lights and emissive layers
 * aren't shaded.
 */
export interface BodyShade {
  readonly direction: Vec3;
  readonly strength: number;
  readonly softness: number;
}

/** The shade's direction unless one is given: from the lower left and in front. */
export const DEFAULT_SHADE: BodyShade = {
  direction: [-0.78, -0.3, -0.55],
  strength: 0,
  softness: 1,
};

export interface PlanetFile {
  readonly kind: PlanetKind;
  /** The body's parts: its surface first (the opaque one), then what is over or about it. */
  readonly parts: readonly BodyPart[];
  readonly materials: Readonly<Record<string, SceneMaterial>>;
  readonly textures: Readonly<Record<string, SceneTexture>>;
  /** None for the Play screen's own, whose lighting is painted in. */
  readonly light?: PlanetLight;
  /** A style's shade on the body it dresses. */
  readonly shade?: BodyShade;
  /** How the planet is best shown, where the data alone isn't it (heroes-capture's tuning, by eye against the game). */
  readonly tuning?: PlanetTuning;
}

/** Settings a planet (or a style's parts) is shown with unless a placement says otherwise. */
export interface PlanetTuning {
  /** The style it wears unless a scene says otherwise. */
  readonly style?: string;
  /** How it wears a style, by the style's id: over the style's own shade and materials' settings. */
  readonly variants?: Readonly<Record<string, StyleWear>>;
  /** How strongly its light lights it, times this (1: as the data has it). */
  readonly lighting?: number;
  readonly shade?: Partial<BodyShade>;
  /** Its materials' settings, by name (a style's: its own materials'). */
  readonly materials?: MaterialSettingsMap;
  /** A tint over all its materials (a planet's: its style's too). */
  readonly tints?: readonly TintLayer[];
  /** Which of its tints are drawn, by id (see `TintsSet`). */
  readonly tintsEnabled?: TintSwitches;
  /** Where its key light comes from (its lights turned together; body frame). */
  readonly lightFrom?: Vec3;
  /** Where its rims and glows lean: a point on its face (body frame). */
  readonly rim?: Vec3;
  /** Which way its surfaces are turned unless set otherwise (see `Orientation`; unset: facing the camera). */
  readonly orientation?: Orientation;
  /** Where its poles point (its frame; unset: its data's pole, `poleOf`), and its turn about them (degrees; unset: 0): see `bodyTurn`. */
  readonly axis?: Vec3;
  readonly turn?: number;
  /** Its base turn (see `bodyTurn`; unset: none). */
  readonly baseTurn?: Quat;
}

/** A style's part as a body wears it: its shape and mapping in place of the style's. */
export interface PartOverride {
  readonly shape?: PartShape;
  readonly mapping?: PartMapping;
}

/**
 * How a planet wears a style: its shade and the style's materials' settings, over the style's;
 * and the style's parts, by their role, shaped and mapped as its own.
 */
export interface StyleWear {
  readonly shade?: Partial<BodyShade>;
  readonly materials?: MaterialSettingsMap;
  readonly parts?: Readonly<Partial<Record<PartRole, PartOverride>>>;
}
