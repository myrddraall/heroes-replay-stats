import type {
  SceneBlend,
  SceneColor,
  SceneLayer,
  SceneMaterial,
  SceneTexture,
  SkyOverlayFile,
} from './play-scene';
import type { TintBlend } from './scene-tints';
import type { LightKind } from './scene-lights';
import { BUILT_IN_PREFIX, type BuiltInPlanets } from './built-in-planets';
import type { AddedPart } from './created-overlays';

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
}

/** One of the Play screen's own planets where the game puts it, at its body's radius there. */
export interface PlayPlacement {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

export interface PlanetIndex {
  readonly planets: readonly PlanetIndexEntry[];
  /** The Play screen's own set. */
  readonly play: readonly PlayPlacement[];
  /** The styles there are (files `style-<id>`). */
  readonly styles: readonly { readonly id: string }[];
}

/** A directional light: the way it travels, and its colour (times its multiplier). */
export interface PlanetDirectionalLight {
  readonly direction: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  /** How softly it falls off round the body: the power of how squarely it faces it (1: as the game lights). */
  readonly softness?: number;
  /** Its shine on a material that has a specular layer: its specular colour times its multiplier (none: none). */
  readonly specular?: readonly [number, number, number];
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

type Vec3 = readonly [number, number, number];

/**
 * A part's shape, in units of the body's radius: a sphere seen from its near side (the body, an
 * outer cloud layer) or its far side (an atmosphere shell modelled inside out: what shows is its
 * far side past the body's limb); or a flat ring in the plane facing the eye, `depth` along the
 * body's y (negative: towards the eye).
 */
export type PartShape =
  | {
      readonly kind: 'sphere';
      readonly radius: number;
      readonly side: 'near' | 'far';
      /** Where its centre is, from the body's (a moon's): the body's by default. */
      readonly centre?: Vec3;
    }
  | {
      readonly kind: 'ring';
      readonly inner: number;
      readonly outer: number;
      readonly depth: number;
      /**
       * How far away (in the body's radii) it was modelled to be seen from, lying on the body's
       * limb from there: seen from elsewhere it is sized to lie there still. None: as it is.
       */
      readonly seen?: number;
    }
  | {
      /** A tube about `axis` (its body's up unless set), `length` long about its centre, open at both ends. */
      readonly kind: 'tube';
      readonly radius: number;
      readonly length: number;
      /** Its outside, nearer wall (`near`), or its inside, farther one (`far`: seen from inside it too). */
      readonly side: 'near' | 'far';
      readonly axis?: Vec3;
      readonly centre?: Vec3;
    }
  | {
      /** A cone (cut off: a frustum) about `axis`, `bottom` wide at its low end to `top` at its high, `length` long, open at both. */
      readonly kind: 'cone';
      readonly bottom: number;
      readonly top: number;
      readonly length: number;
      readonly side: 'near' | 'far';
      readonly axis?: Vec3;
      readonly centre?: Vec3;
    }
  | {
      /** A flat disc (a hole in it `inner` wide: an annulus) square to `axis`, about its centre. */
      readonly kind: 'disc';
      readonly inner: number;
      readonly outer: number;
      readonly axis?: Vec3;
      readonly centre?: Vec3;
    }
  | {
      /** A capsule about `axis`: a tube `length` long, closed at both ends by half spheres. */
      readonly kind: 'capsule';
      readonly radius: number;
      readonly length: number;
      readonly side: 'near' | 'far';
      readonly axis?: Vec3;
      readonly centre?: Vec3;
    }
  | {
      /** A flat rectangle square to `axis` (facing the eye unless set), `height` along `up` (its body's up unless set). */
      readonly kind: 'plane';
      readonly width: number;
      readonly height: number;
      readonly axis?: Vec3;
      readonly up?: Vec3;
      readonly centre?: Vec3;
    };

/** The shapes drawn round an axis: tubes, cones, discs and capsules (their axis their body's up unless set). */
export type RoundShape = Extract<PartShape, { kind: 'tube' | 'cone' | 'disc' | 'capsule' }>;

/** A round shape's axis, or a plane's (the way it faces): its own, else its body's up (a plane: the eye). */
export const axisOf = (shape: RoundShape | Extract<PartShape, { kind: 'plane' }>): Vec3 =>
  shape.axis ?? (shape.kind === 'plane' ? [0, -1, 0] : [0, 0, 1]);

/** A plane's texture: across it once, from its left to its right and its top to its bottom (`repeat` times, mirrored when flipped). */
export function planeMapping(
  shape: Extract<PartShape, { kind: 'plane' }>,
  repeat = 1,
  flip = false,
): PartMapping {
  const axis = axisOf(shape);
  const up = shape.up ?? [0, 0, 1];
  const right: Vec3 = [
    up[1] * axis[2] - up[2] * axis[1],
    up[2] * axis[0] - up[0] * axis[2],
    up[0] * axis[1] - up[1] * axis[0],
  ];
  const along = (v: Vec3, size: number, sign: number) =>
    [
      (v[0] * sign * repeat) / size,
      (v[1] * sign * repeat) / size,
      (v[2] * sign * repeat) / size,
      0.5,
    ] as const;
  return {
    kind: 'linear',
    u: along(right, shape.width, flip ? -1 : 1),
    v: along(up, shape.height, -1),
  };
}

/** How far a part's shape reaches from its body's centre, in its radii (a ring's: its outer edge). */
export function shapeReach(shape: PartShape): number {
  const off = 'centre' in shape && shape.centre ? Math.hypot(...shape.centre) : 0;
  switch (shape.kind) {
    case 'sphere':
      return shape.radius + off;
    case 'ring':
      return shape.outer;
    case 'tube':
      return Math.hypot(shape.radius, shape.length / 2) + off;
    case 'cone':
      return Math.hypot(Math.max(shape.bottom, shape.top), shape.length / 2) + off;
    case 'disc':
      return shape.outer + off;
    case 'capsule':
      return shape.length / 2 + shape.radius + off;
    case 'plane':
      return Math.hypot(shape.width, shape.height) / 2 + off;
  }
}

/**
 * How a part's surface maps to its materials' texture coordinates. A uv sphere: u round the pole
 * from the meridian (the other way round when flipped), from u0; v by the angle from the pole,
 * `v` its values at even steps from the pole to the opposite one (as the game's mesh has it: not
 * always a straight line). Linear: u and v each a·x + b·y + c·z + d of the point. A ring: u greatest
 * (uMax) at the azimuth `from` (radians in the body's xz plane, from +x towards +z), falling to 0
 * at the opposite side either way round; v 0 at both edges, 1 midway. Round (a tube's, a cone's,
 * a disc's): u round `axis` from `meridian` (the other way round when flipped), from u0, `repeat`
 * times round; v along the axis (`along: 'height'`) or out from it (`'radius'`), 0 at `v0`, 1 at
 * `v1` (from the shape's centre).
 */
export type PartMapping =
  | {
      readonly kind: 'sphere';
      readonly pole: Vec3;
      readonly meridian: Vec3;
      readonly flip: boolean;
      readonly u0: number;
      readonly v: readonly number[];
    }
  | {
      readonly kind: 'linear';
      readonly u: readonly [number, number, number, number];
      readonly v: readonly [number, number, number, number];
    }
  | {
      readonly kind: 'ring';
      readonly from: number;
      readonly uMax: number;
      /** How far across the ring (from its inner edge, 0 to 1) v is greatest (none: midway). */
      readonly mid?: number;
    }
  | {
      readonly kind: 'round';
      readonly axis: Vec3;
      readonly meridian: Vec3;
      readonly flip: boolean;
      readonly u0: number;
      readonly repeat: number;
      readonly along: 'height' | 'radius';
      readonly v0: number;
      readonly v1: number;
    };

/**
 * What a part is to its body: its surface, a layer on it, its atmosphere shell, a ring, a style's
 * shield; or a part of an overlay made in the editor (a sphere, a ring, the sky's band).
 */
export type PartRole =
  | 'surface'
  | 'layer'
  | 'shell'
  | 'ring'
  | 'shield'
  | 'sphere'
  | 'band'
  | 'tube'
  | 'cone'
  | 'disc'
  | 'capsule'
  | 'plane';

/**
 * A part of a placed body by whose it is and which part of it it is: the body's own by its part
 * (`own:surface`), or an overlay's it wears by the overlay and its part (`style:nexus:shield`),
 * so overlays worn together keep their parts apart.
 */
export type PartKey = `own:${string}` | `style:${string}:${string}`;
/** Which of its owner's parts a part is: its id, where it has one (an overlay made in the editor), else its role. */
export const partId = (part: { readonly id?: string; readonly role: PartRole }) =>
  part.id ?? part.role;
/** A body's own part's key. */
export const ownPartKey = (part: { readonly id?: string; readonly role: PartRole }): PartKey =>
  `own:${partId(part)}`;
/** An overlay's part's key, the overlay worn by its id. */
export const overlayPartKey = (
  overlay: string,
  part: { readonly id?: string; readonly role: PartRole },
): PartKey => `style:${overlay}:${partId(part)}`;
/** The overlay a part's key is of (none: the body's own). */
export const overlayOfPartKey = (key: PartKey): string | undefined =>
  key.startsWith('style:') ? key.split(':')[1] : undefined;

/**
 * A part's shape and how its textures lie on it, in place of its own (each where set), relative to
 * its body (so a style's part fits any planet it is worn by): its size (times its own: a sphere's
 * radius, a ring's radii); a sphere's textures turned about its pole (`turn`, degrees) and its pole
 * tilted (`tilt`, degrees, its top towards the eye); a ring's width (times its own, about its middle
 * circle), its plane's depth along the line of sight (body radii; negative: towards the eye), the
 * circle across it its texture is brightest on (`mid`, 0 its inner edge to 1 its outer), and
 * whether it keeps to its body's limb seen from wherever its body is (`keepToLimb`, where it was
 * modelled to).
 */
export interface PartSettings {
  /** Its name as shown, in place of its role's (Surface, Shield, Ring…). */
  readonly label?: string;
  /** Whether it is drawn (its materials with it). */
  readonly enabled?: boolean;
  readonly size?: number;
  readonly turn?: number;
  readonly tilt?: number;
  readonly width?: number;
  /** A sky's band's height, times its own, about its middle (up and down); a tube's or a cone's length, times its own. */
  readonly height?: number;
  /** A tube's or a cone's side: its outside (`near`) or its inside (`far`), in place of its own. */
  readonly side?: 'near' | 'far';
  readonly depth?: number;
  readonly mid?: number;
  readonly keepToLimb?: boolean;
  /** A sphere's textures round it the other way (mirrored), in place of its own way. */
  readonly flip?: boolean;
  /** A ring's texture turned round it: where it is greatest (degrees round its plane), in place of its own. */
  readonly from?: number;
  /** How many times a ring's texture goes round it (its u at its greatest), in place of its own. */
  readonly repeat?: number;
}

/** Parts' settings by part. */
export type PartSettingsMap = Readonly<Partial<Record<PartKey, PartSettings>>>;

/** Parts' settings from several levels, the later over the earlier, each setting its own. */
export function mergePartSettings(
  ...levels: readonly (PartSettingsMap | undefined)[]
): PartSettingsMap {
  const out: Partial<Record<PartKey, PartSettings>> = {};
  for (const level of levels)
    for (const [key, settings] of Object.entries(level ?? {}) as [PartKey, PartSettings][])
      out[key] = { ...out[key], ...settings };
  return out;
}

/** `v` turned about unit `axis` by `degrees` (right-handed). */
function turned(v: Vec3, axis: Vec3, degrees: number): Vec3 {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const d = (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - c);
  return [
    v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * d,
    v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * d,
    v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * d,
  ];
}

/**
 * A mapping turned with its part: about its pole (a uv sphere's; z, its body's up, for a linear
 * one) by `turn`, then about the body's x (to the right) by `tilt`, its top towards the eye (-y).
 * The texture moves with it: a point reads what the point turned back read.
 */
function turnedMapping(mapping: PartMapping, turn: number, tilt: number): PartMapping {
  if (mapping.kind === 'ring' || mapping.kind === 'round' || (!turn && !tilt)) return mapping;
  const pole: Vec3 = mapping.kind === 'sphere' ? mapping.pole : [0, 0, 1];
  const r = (v: Vec3) => turned(turned(v, pole, turn), [1, 0, 0], tilt);
  if (mapping.kind === 'sphere')
    return { ...mapping, pole: r(mapping.pole), meridian: r(mapping.meridian) };
  const coefficients = (k: readonly [number, number, number, number]) => {
    const [x, y, z] = r([k[0], k[1], k[2]]);
    return [x, y, z, k[3]] as const;
  };
  return { ...mapping, u: coefficients(mapping.u), v: coefficients(mapping.v) };
}

/** A part with its settings applied (see `PartSettings`). */
export function withPart(part: BodyPart, settings: PartSettings | undefined): BodyPart {
  if (!settings) return part;
  const { size = 1, turn = 0, tilt = 0 } = settings;
  const { shape } = part;
  if (
    shape.kind === 'tube' ||
    shape.kind === 'cone' ||
    shape.kind === 'disc' ||
    shape.kind === 'capsule'
  )
    return withRoundPart(part, shape, settings);
  if (shape.kind === 'plane') {
    // Sized, its width and height each times its own; tilted about the body's x, turned about
    // where it faces; its texture across it as it is now.
    const tilted = (v: Vec3) => turned(v, [1, 0, 0], tilt);
    const axis = tilted(axisOf(shape));
    const up = tilted(turned(shape.up ?? [0, 0, 1], axisOf(shape), turn));
    const plane = {
      ...shape,
      width: shape.width * size * (settings.width ?? 1),
      height: shape.height * size * (settings.height ?? 1),
      axis,
      up,
      ...(shape.centre ? { centre: shape.centre.map((c) => c * size) as unknown as Vec3 } : {}),
    };
    return {
      ...part,
      shape: plane,
      mapping: planeMapping(plane, settings.repeat ?? 1, settings.flip ?? false),
    };
  }
  if (shape.kind === 'sphere') {
    const mapping = turnedMapping(part.mapping, turn, tilt);
    return {
      ...part,
      shape: { ...shape, radius: shape.radius * size },
      mapping:
        mapping.kind === 'sphere' && settings.flip !== undefined
          ? { ...mapping, flip: settings.flip }
          : mapping,
      ...(part.mapping2 ? { mapping2: turnedMapping(part.mapping2, turn, tilt) } : {}),
    };
  }
  const middle = ((shape.inner + shape.outer) / 2) * size;
  const half = ((shape.outer - shape.inner) / 2) * size * (settings.width ?? 1);
  const { seen, ...rest } = shape;
  const keep = settings.keepToLimb ?? seen !== undefined;
  return {
    ...part,
    shape: {
      ...rest,
      inner: Math.max(0, middle - half),
      outer: middle + half,
      depth: settings.depth ?? shape.depth,
      ...(keep && seen !== undefined ? { seen } : {}),
    },
    mapping:
      part.mapping.kind === 'ring'
        ? {
            ...part.mapping,
            ...(settings.mid !== undefined ? { mid: settings.mid } : {}),
            ...(settings.from !== undefined ? { from: (settings.from * Math.PI) / 180 } : {}),
            ...(settings.repeat !== undefined ? { uMax: settings.repeat } : {}),
          }
        : part.mapping,
  };
}

/**
 * A tube, cone or disc with its settings applied: sized (and a tube's or cone's length times its
 * Height, a disc's width about its middle times its Width), its axis tilted about the body's x
 * (its top towards the eye) and its texture turned round the axis by Turn, mirrored, repeated.
 */
function withRoundPart(part: BodyPart, shape: RoundShape, settings: PartSettings): BodyPart {
  const { size = 1, turn = 0, tilt = 0 } = settings;
  const tilted = (v: Vec3) => turned(v, [1, 0, 0], tilt);
  const axis = tilted(axisOf(shape));
  const centre = shape.centre && { centre: shape.centre.map((c) => c * size) as unknown as Vec3 };
  const length = 'length' in shape ? shape.length * size * (settings.height ?? 1) : 0;
  const sized: RoundShape =
    shape.kind === 'tube' || shape.kind === 'capsule'
      ? { ...shape, radius: shape.radius * size, length, side: settings.side ?? shape.side }
      : shape.kind === 'cone'
        ? {
            ...shape,
            bottom: shape.bottom * size,
            top: shape.top * size,
            length,
            side: settings.side ?? shape.side,
          }
        : (() => {
            const middle = ((shape.inner + shape.outer) / 2) * size;
            const half = ((shape.outer - shape.inner) / 2) * size * (settings.width ?? 1);
            return { ...shape, inner: Math.max(0, middle - half), outer: middle + half };
          })();
  const mapping = part.mapping;
  return {
    ...part,
    shape: { ...sized, axis, ...centre },
    mapping:
      mapping.kind === 'round'
        ? {
            ...mapping,
            axis: tilted(mapping.axis),
            meridian: tilted(turned(mapping.meridian, mapping.axis, turn)),
            ...(settings.flip !== undefined ? { flip: settings.flip } : {}),
            ...(settings.repeat !== undefined ? { repeat: settings.repeat } : {}),
            // Along its length or across its width as it is now.
            ...(mapping.along === 'height' && length
              ? {
                  v0: (mapping.v0 / ('length' in shape ? shape.length : 1)) * length,
                  v1: (mapping.v1 / ('length' in shape ? shape.length : 1)) * length,
                }
              : mapping.along === 'radius' && sized.kind === 'disc'
                ? { v0: sized.inner, v1: sized.outer }
                : {}),
          }
        : mapping,
  };
}

/**
 * A grid's (the shield's) light, its own: it lights nothing, it says where the grid shows and where
 * it is active. From all round (`ambient`: all of it alike) or from a side (`from`, body frame,
 * any side, the far one too), as strong as `strength` (past 1, further round fully), reaching round
 * the face (`reach`: 0 the half facing it, 1 on round to the point facing away) as softly as
 * `softness` (the power of how squarely the face turns to it). What it does: reveals the grid
 * (`reveals`: shows it), activates it (`activates`: turns it from its inactive colour to its active
 * one, revealing `energizes` times as much there too and shining `glow` brighter), either or both;
 * one that darkens (`darkens`) does the opposite: hides it, deactivates it.
 */
export interface GridLight {
  readonly id: `grid-${string}`;
  readonly name: string;
  readonly kind: LightKind;
  readonly enabled?: boolean;
  readonly darkens?: boolean;
  readonly strength?: number;
  readonly from?: Vec3;
  readonly softness?: number;
  readonly reach?: number;
  readonly reveals?: boolean;
  readonly activates?: boolean;
  readonly energizes?: number;
  readonly glow?: number;
}

/**
 * How a material shows, where something says (a planet's tuning, a style's, a placement): the
 * data's way otherwise. The same settings for any material, a planet's, a style's or the sky's;
 * each does nothing where the material has nothing for it to act on (a strength on an opaque
 * material, a scale without an emissive layer).
 */
export interface MaterialSettings {
  /** Its name as shown, in place of the one made from the data's (its data name stays its key). */
  readonly label?: string;
  /** Whether it is drawn at all. */
  readonly enabled?: boolean;
  /** How strongly it shows, 0 to 1 (1: as the data has it): a blended material's alpha times this. */
  readonly strength?: number;
  /** How it blends over what is behind it, in place of the data's. */
  readonly blend?: SceneBlend;
  /** Its glow: 0 none, 1 its own light's bloom as the data has it, past 1 its emissive light boosted into the bloom. */
  readonly glow?: number;
  /**
   * A grid's colours (`#rrggbb`): inactive (its own, the data's) where it isn't activated, active
   * where it is fully, blended between.
   */
  readonly inactive?: string;
  readonly active?: string;
  /**
   * A grid's (the shield's) lights, its own (see `GridLight`): where it shows and where it is
   * active. Set as a whole, a level's list in place of the one under it.
   */
  readonly gridLights?: readonly GridLight[];
  /**
   * A grid's reveal and activation of before its lights were its own (read as its lights where
   * none are set: `gridLightsOf`): its reveal from `revealFrom`, reaching round the face
   * (`revealReach`), falling off (`revealFalloff`), as strong as `revealStrength`, unless
   * `revealOn` is false; its activation (once `activationOn`) shaped so, from the reveal's side
   * while `activationTied`, energizing (`activationEnergizes`) and glowing (`activationGlow`).
   */
  readonly revealOn?: boolean;
  readonly revealStrength?: number;
  readonly revealFrom?: Vec3;
  readonly revealReach?: number;
  readonly revealFalloff?: number;
  /**
   * A grid's activation: its colour from inactive to active, shaped as its reveal is (off unless
   * `activationOn`); its side the reveal's while `activationTied` (unless false); revealing what
   * it activates too (`activationEnergizes` times as much), and shining brighter and blooming
   * more there (`activationGlow`).
   */
  readonly activationOn?: boolean;
  readonly activationStrength?: number;
  readonly activationTied?: boolean;
  readonly activationFrom?: Vec3;
  readonly activationReach?: number;
  readonly activationFalloff?: number;
  readonly activationEnergizes?: number;
  readonly activationGlow?: number;
  /** How far it shows away from the limb, 0 to 1: a floor under its layers' fresnel (unset: each layer's own). */
  readonly spread?: number;
  /**
   * A lit material's shine where it has a specular layer: how strong (its specular multiplier, in
   * place of the data's), and how glossy (the highlight's power: higher, tighter; in place of its
   * specularity).
   */
  readonly specular?: number;
  readonly glossiness?: number;
  /**
   * The side it spreads from: the point on its face (body frame) its layers' fresnel is brightest
   * on, as a light comes from one (unset: each layer's own turn).
   */
  readonly spreadFrom?: Vec3;
  /**
   * How sharply its layers' fresnel (the kind strongest edge-on) rises toward the edge: the
   * formula to this power (2, as measured on the Play screen planets' grid, unless set).
   */
  readonly falloff?: number;
  /**
   * How large its emissive pattern is, drawn or textured alike (2: twice the size): a texture's
   * tiling over this, a drawn pattern's cells round the part over this.
   */
  readonly scale?: number;
  /**
   * How a part with a drawn pattern shows it: drawn (`pattern`, the default) or as the game does,
   * its emissive texture (`texture`), to compare the two.
   */
  readonly drawAs?: MaterialDrawAs;
  /**
   * The textures its alpha masks read, in place of its own, in order (by name: a texture of a
   * planet it is drawn on, so loaded with it): a body wearing a style its own mask on its parts.
   */
  readonly masks?: readonly string[];
  /** How much of its emissive pattern is cut to black, 0 to 1: a grid's cells go, its lines stay. */
  readonly cut?: number;
  /** How wide its drawn pattern's lines are, as a share of a cell (0 to 0.5). */
  readonly width?: number;
  /** How softly its drawn pattern's lines glow about themselves, 0 to 1. */
  readonly soft?: number;
  /** A colour blended over it. */
  readonly tint?: MaterialTint;
  /**
   * Where it is drawn among the scene's objects (a sky material's say): behind them all, as if
   * infinitely far (`background`, the sky's default), among them at its own depth (`scene`), or in
   * front of them all, as if at the camera (`foreground`).
   */
  readonly depth?: MaterialDepth;
  /**
   * Whether its body's light lights it (`true`), or it shows as its textures have it, flat (a
   * painting with its light painted in); unset: as the data has it (`unshaded`). A lit one on a
   * body with no light shows flat.
   */
  readonly lit?: boolean;
  /** Its layers' textures and how they lie on it, each layer's where set (by its slot). */
  readonly layers?: Partial<Record<LayerSlot, LayerSettings>>;
}

/** A material's layers by where they are in it: its diffuse, its emissive, its first and second alpha mask. */
export type LayerSlot = 'diffuse' | 'emissive' | 'mask1' | 'mask2';

/**
 * A layer's texture and how it lies on its material, in place of the data's (each where set): its
 * texture (by key: one loaded with what it is drawn on, else its own is kept), how far it is moved
 * (`offset`, in the texture's own widths), turned (`rotation`, degrees about its middle), repeated
 * (`tiling`, times across u and v), scrolled (`scroll`, texture widths a second; [0, 0] still) and
 * whether it repeats or stops at its edges (`wrap`, across u and across v).
 */
export interface LayerSettings {
  /** Its name as shown, in place of its slot's (Diffuse, Emissive, Mask). */
  readonly label?: string;
  readonly texture?: string;
  readonly offset?: readonly [number, number];
  readonly rotation?: number;
  readonly tiling?: readonly [number, number];
  readonly scroll?: readonly [number, number];
  readonly wrap?: readonly [boolean, boolean];
}

/** A material's layers that are there, by slot, in order. */
export function layerSlots(material: SceneMaterial): [LayerSlot, SceneLayer][] {
  const out: [LayerSlot, SceneLayer][] = [];
  if (material.diffuse) out.push(['diffuse', material.diffuse]);
  if (material.emissive) out.push(['emissive', material.emissive]);
  material.alphaMasks.slice(0, 2).forEach((m, i) => out.push([i ? 'mask2' : 'mask1', m]));
  return out;
}

/** A layer with its settings applied (a texture `loaded` doesn't have: its own kept). */
export function withLayer(
  layer: SceneLayer,
  settings: LayerSettings | undefined,
  loaded: (texture: string) => boolean = () => true,
): SceneLayer {
  if (!settings) return layer;
  const { texture, offset, rotation, tiling, scroll, wrap } = settings;
  return {
    ...layer,
    ...(texture && loaded(texture) ? { texture } : {}),
    ...(offset ? { offset } : {}),
    ...(rotation !== undefined ? { angle: (rotation * Math.PI) / 180 } : {}),
    ...(tiling ? { tiling } : {}),
    ...(wrap ? { wrap } : {}),
    ...(scroll
      ? {
          scroll: scroll[0] || scroll[1] ? { seconds: 1, by: scroll, endless: true } : undefined,
        }
      : {}),
  };
}

/** A material with its layers' settings applied, by slot (see `withLayer`). */
export function withLayers(
  material: SceneMaterial,
  layers: MaterialSettings['layers'],
  loaded?: (texture: string) => boolean,
): SceneMaterial {
  if (!layers) return material;
  const at = (slot: LayerSlot, layer: SceneLayer | null) =>
    layer ? withLayer(layer, layers[slot], loaded) : layer;
  return {
    ...material,
    diffuse: at('diffuse', material.diffuse),
    emissive: at('emissive', material.emissive),
    alphaMasks: material.alphaMasks.map((m, i) =>
      i < 2 ? withLayer(m, layers[i ? 'mask2' : 'mask1'], loaded) : m,
    ),
  };
}

/**
 * A colour blended over a material's own, as CSS's blend modes of those names do, by `strength`
 * (0: not at all, 1: all the way); a colour past white keeps its brightness.
 */
export interface MaterialTint {
  /** `#rrggbb`. */
  readonly colour: string;
  readonly blend: TintBlend;
  readonly strength: number;
}

/** Where a material is drawn among the scene's objects: behind them, among them or in front. */
export type MaterialDepth = 'background' | 'scene' | 'foreground';

/** How a material with a drawn pattern shows it: drawn, or as its texture (the game's way). */
export type MaterialDrawAs = 'pattern' | 'texture';

/** Materials' settings by the materials' names. */
export type MaterialSettingsMap = Readonly<Record<string, MaterialSettings>>;

/**
 * How the sky shows: its materials' settings by key (`materialKey`), a tint over all of it
 * (its stars too), and the overlays it wears.
 */
export interface SkySettings {
  /** Its materials' settings: its own by name (over their base settings), its overlays' by `materialKey`. */
  readonly materials?: MaterialSettingsMap;
  /** The materials' base settings, by name (under its overlays' materials' own). */
  readonly base?: MaterialSettingsMap;
  readonly tint?: MaterialTint;
  /** Its materials' draw order, by `materialKey` (the later over the earlier; see `drawOrder`), where set. */
  readonly order?: readonly string[];
  /** The overlays it wears and draws, in order, by id (none given: its data's). */
  readonly overlays?: readonly string[];
  /** Its overlays' parts' settings, by part (`style:<overlay>:<part>`). */
  readonly parts?: PartSettingsMap;
  /** Its own parts (added onto it): their file, and the images their textures are. */
  readonly own?: {
    readonly file: SkyOverlayFile;
    readonly images: Readonly<Record<string, ImageBitmap>>;
  };
  /** The parts added onto it, under those built (`own`): as the design has them. */
  readonly addedParts?: readonly AddedPart[];
  /** Overlays made in the editor it wears, by id: their files, and the images their textures are. */
  readonly made?: Readonly<
    Record<
      string,
      { readonly file: SkyOverlayFile; readonly images: Readonly<Record<string, ImageBitmap>> }
    >
  >;
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
  readonly tint?: MaterialTint;
  /** Where its key light comes from (its lights turned together; body frame). */
  readonly lightFrom?: Vec3;
  /** Where its rims and glows lean: a point on its face (body frame). */
  readonly rim?: Vec3;
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

/** How a planet (its file) wears a style (by its id; none: none). */
export const wearOf = (planet: PlanetFile | undefined, style: string | undefined) =>
  style ? planet?.tuning?.variants?.[style] : undefined;

/** A style's parts as a planet wears them (its own shapes and mappings for them, where it has any). */
export function wornParts(
  planet: PlanetFile | undefined,
  style: string | undefined,
  parts: readonly BodyPart[],
): readonly BodyPart[] {
  const own = wearOf(planet, style)?.parts;
  return own ? parts.map((p) => (own[p.role] ? { ...p, ...own[p.role] } : p)) : parts;
}

/** A material with its alpha masks reading other textures (`masks`, in order), where given. */
export function withMasks(
  material: SceneMaterial,
  masks: readonly string[] | undefined,
): SceneMaterial {
  if (!masks?.length) return material;
  return {
    ...material,
    alphaMasks: material.alphaMasks.map((m, i) => (masks[i] ? { ...m, texture: masks[i] } : m)),
  };
}

/** A material as its draw order needs it: its name, how it blends, its priority in the data. */
export interface Ordered {
  readonly name: string;
  readonly blend: SceneBlend;
  readonly priority?: number;
}

/**
 * Materials' names in the order they are drawn (the later over the earlier): the opaque ones first,
 * by priority (a surface under what glows over it); then the rest as `order` lists them
 * where it is given (those it leaves out after, in their own order), else by their priority,
 * highest first, ties as the data lists them.
 */
export function drawOrder(materials: readonly Ordered[], order?: readonly string[]): string[] {
  const byPriority = (a: { m: Ordered; i: number }, b: { m: Ordered; i: number }) =>
    (b.m.priority ?? 0) - (a.m.priority ?? 0) || a.i - b.i;
  const byData = materials.map((m, i) => ({ m, i }));
  const opaque = byData.filter(({ m }) => m.blend === 'opaque').sort(byPriority);
  const rest = byData.filter(({ m }) => m.blend !== 'opaque').sort(byPriority);
  const rank = (name: string, fallback: number) => {
    const at = order?.indexOf(name) ?? -1;
    return at >= 0 ? at : (order?.length ?? 0) + fallback;
  };
  const ordered = order
    ? rest.map((x, i) => ({ ...x, r: rank(x.m.name, i) })).sort((a, b) => a.r - b.r)
    : rest;
  return [...new Set([...opaque, ...ordered].map(({ m }) => m.name))];
}

/**
 * A draw order with `name` moved to just before (or after) `target`. Moved within its group
 * (`group`: the names shown with it), it takes one of its group's places, the rest of the order as
 * it is; moved from another group, it goes beside `target` in the whole order.
 */
export function reordered(
  order: readonly string[],
  group: readonly string[],
  name: string,
  target: string,
  after: boolean,
): string[] {
  if (name === target) return [...order];
  const place = (list: string[]) => {
    const at = list.indexOf(target);
    if (at < 0) return [...list, name];
    list.splice(at + (after ? 1 : 0), 0, name);
    return list;
  };
  if (!group.includes(name) || !group.includes(target))
    return place(order.filter((n) => n !== name));
  const inGroup = order.filter((n) => group.includes(n));
  const moved = place(inGroup.filter((n) => n !== name));
  let next = 0;
  return order.map((n) => (group.includes(n) ? moved[next++]! : n));
}

/** A planet with its textures decoded, ready to draw. */
export interface LoadedPlanet {
  readonly id: string;
  /** What it is called where it isn't its id (one the app makes). */
  readonly label?: string;
  readonly planet: PlanetFile;
  readonly images: Readonly<Record<string, ImageBitmap>>;
}

const at = (base: string, file: string) => new URL(file, new URL(base, document.baseURI)).href;

async function fetchOk(url: string, what: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${what} (${response.status} ${response.statusText})`);
  return response;
}

/** The planets there are, from the scene's directory. */
export async function loadPlanetIndex(base: string, signal?: AbortSignal): Promise<PlanetIndex> {
  const response = await fetchOk(at(base, 'planets/index.json'), 'the planets', signal);
  return (await response.json()) as PlanetIndex;
}

/** A planet's file from the scene's directory, as exported (its textures not loaded). */
export async function loadPlanetFile(
  base: string,
  id: string,
  signal?: AbortSignal,
): Promise<PlanetFile> {
  const response = await fetchOk(at(base, `planets/${id}.json`), `the planet ${id}`, signal);
  const planet = (await response.json()) as PlanetFile;
  if (!planet.parts?.length) throw new Error(`the planet ${id} has no parts`);
  return planet;
}

/**
 * Loads planets from the scene's directory, each once (the textures are the scene's, beside it,
 * decoded as stored, as the scene's are: nothing premultiplied or colour-converted). A load is
 * shared by all who ask for the planet, so no one's abort stops it: a caller that no longer
 * wants it just stops waiting (its signal rejects its own wait).
 */
export class PlanetLoader {
  private readonly loading = new Map<string, Promise<LoadedPlanet>>();

  /** `builtIns`: the planets the app makes (their ids start `@`), where there are any. */
  constructor(
    private readonly base: string,
    private readonly builtIns?: BuiltInPlanets,
  ) {}

  load(id: string, signal?: AbortSignal): Promise<LoadedPlanet> {
    let loading = this.loading.get(id);
    if (!loading) {
      loading = this.fetch(id).catch((error: unknown) => {
        this.loading.delete(id); // not kept: asked for again, it is tried again
        throw error;
      });
      this.loading.set(id, loading);
    }
    if (!signal) return loading;
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('aborted', 'AbortError'),
        );
        return;
      }
      const abort = () =>
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('aborted', 'AbortError'),
        );
      signal.addEventListener('abort', abort, { once: true });
      loading.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  private async fetch(id: string): Promise<LoadedPlanet> {
    const built = id.startsWith(BUILT_IN_PREFIX) ? this.builtIns?.(id) : undefined;
    if (id.startsWith(BUILT_IN_PREFIX) && !built) throw new Error(`no planet ${id} is made here`);
    const planet = built?.planet ?? (await loadPlanetFile(this.base, id));
    const entries = await Promise.all(
      Object.entries(planet.textures).map(async ([key, texture]) => {
        const made = built?.images?.[key];
        if (made) return [key, await made()] as const;
        const image = await fetchOk(at(this.base, texture.file), `the texture ${texture.file}`);
        const bitmap = await createImageBitmap(await image.blob(), {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        });
        return [key, bitmap] as const;
      }),
    );
    return { id, label: built?.label, planet, images: Object.fromEntries(entries) };
  }
}
