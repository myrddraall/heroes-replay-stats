import type { BodyPart } from './planet-files';
import type { PartSettings } from './settings-types';

export type Vec3 = readonly [number, number, number];

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
