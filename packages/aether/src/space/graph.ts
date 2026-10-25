import { type BodyFrame, bodyFrame, viewUp, type Viewpoint } from './space';

/**
 * The scene as a tree of things, each placed in its parent: the scene holds groups and planets,
 * a group its planets (and groups), a planet its moons; a body's parts and lights hang from the
 * body, the scene's lights and cameras from the scene. Each thing has a local transform (where
 * it is in its parent, how it is turned, how big), and its place in the world is its parent's
 * world transform applied to it, up the chain. One world: the scene's units, z up.
 *
 * A body's own turn is its placement frame (`placementFrame`): turned as the scene's own camera
 * (the scene file's, `layout`) sees it from where it ends up, x across, y away from that eye, z
 * up. It is fixed in the world, whatever camera draws it: what is placed in a body (its moons, the
 * lights of its surfaces fixed in the world) stays where it is as any other camera goes round. A
 * body's surface may still be drawn facing the eye that draws it (its Orientation `camera`, the
 * game's billboards): that frame (`BodyFrame` from the live camera) is for drawing and for its
 * lighting (kept to the eye), never for placing. Either way the surface is turned by the body's
 * own turn (its Turn about its Axis, `bodyTurn`): in the world, or against the eye.
 */

export type Vec3 = readonly [number, number, number];

/** A turn: its axes in its parent, column by column (x, y, z), as `BodyFrame.axes` has them. */
export type Mat3 = ArrayLike<number>;

/** No turn at all. */
export const IDENTITY: Mat3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Where a thing is in its parent: a place, a turn and a size (the same every way), in its parent's units. */
export interface Transform {
  readonly position: Vec3;
  readonly rotation: Mat3;
  readonly scale: number;
}

/** In place, unturned, its parent's size. */
export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: IDENTITY, scale: 1 };

/**
 * A thing's local transform; its turn either given, or `layout`: its placement frame, as the
 * scene's own camera sees it from wherever it ends up in the world, whatever its parent's turn.
 */
export interface LocalTransform {
  readonly position: Vec3;
  readonly rotation: Mat3 | 'layout';
  readonly scale: number;
}

/** What a thing in the scene is. */
export type NodeKind = 'scene' | 'group' | 'planet' | 'moon' | 'camera' | 'sky';

/** A thing in the scene: its id, what it is, its parent's id (none: the scene itself) and its local transform. */
export interface SceneNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly parent: string | null;
  readonly local: LocalTransform;
}

/**
 * Which way a body's surface (a part of it, a material of a part) is turned: towards the eye
 * that draws it (the game's billboards: its face always the same), or fixed in the world (its
 * far side and its poles seen as the camera goes round).
 */
export type Orientation = 'camera' | 'world';

/** A surface faces the camera unless set otherwise. */
export const DEFAULT_ORIENTATION: Orientation = 'camera';

/**
 * Which way one draw of a body (a material on a part) is turned, from the most particular say to
 * the least: its material's, its part's, its body's, its body's tuning's; facing the camera where
 * none says.
 */
export function orientationOf(...says: readonly (Orientation | undefined)[]): Orientation {
  return says.find((o) => o !== undefined) ?? DEFAULT_ORIENTATION;
}

/**
 * How one draw of a body is turned: its Orientation, and whether the body's own turn (its Axis
 * and Turn: `bodyTurn`) turns it. A halo (`haloLike`: a ring round the limb, a shell seen past
 * it, a glow) faces the camera square on, whatever its body says, unless its part or its
 * material sets an Orientation of its own: then it is turned as any other part is.
 */
export interface DrawTurn {
  readonly orientation: Orientation;
  readonly turned: boolean;
}

/**
 * Which way one draw of a body is turned (see `DrawTurn`): its material's say, else its part's
 * (either turned with the body), else a halo square to the camera, else its body's levels', the
 * most particular first (its body's, its tuning's), facing the camera where none says.
 */
export function drawTurnOf(
  material: Orientation | undefined,
  part: Orientation | undefined,
  halo: boolean,
  ...body: readonly (Orientation | undefined)[]
): DrawTurn {
  const own = material ?? part;
  if (own) return { orientation: own, turned: true };
  if (halo) return { orientation: 'camera', turned: false };
  return { orientation: orientationOf(...body), turned: true };
}

/** Where a body's poles point where its data has no pole of its own (no uv sphere): straight up. */
export const DEFAULT_AXIS: Vec3 = [0, 0, 1];

const isIdentityTurn = (m: Mat3) => {
  for (let i = 0; i < 9; i++) if (m[i] !== IDENTITY[i]) return false;
  return true;
};

/** Whether a turn is none at all, number for number. */
export const isIdentity = isIdentityTurn;

/** Two turns, `a` after `b` (a·b). */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 3; r++) out.push(a[r]! * b[c * 3]! + a[3 + r]! * b[c * 3 + 1]! + a[6 + r]! * b[c * 3 + 2]!);
  return out;
}

/** A turn undone (its transpose). */
export function transpose(m: Mat3): Mat3 {
  return [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!];
}

/** A vector turned (m·v): from the turn's own axes into its parent's. */
export function turn(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0]! * v[0] + m[3]! * v[1] + m[6]! * v[2],
    m[1]! * v[0] + m[4]! * v[1] + m[7]! * v[2],
    m[2]! * v[0] + m[5]! * v[1] + m[8]! * v[2],
  ];
}

/** A vector turned back (mᵀ·v): from the parent's axes into the turn's own. */
export function turnBack(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2],
    m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2],
    m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2],
  ];
}

/** A point in a thing (its local units) where its transform puts it in its parent. */
export function pointToWorld(t: Transform, p: Vec3): Vec3 {
  const m = t.rotation;
  const s = t.scale;
  return [
    t.position[0] + (m[0]! * p[0] + m[3]! * p[1] + m[6]! * p[2]) * s,
    t.position[1] + (m[1]! * p[0] + m[4]! * p[1] + m[7]! * p[2]) * s,
    t.position[2] + (m[2]! * p[0] + m[5]! * p[1] + m[8]! * p[2]) * s,
  ];
}

/** A point in a thing's parent, in the thing's own axes and units. */
export function pointToLocal(t: Transform, p: Vec3): Vec3 {
  const d: Vec3 = [p[0] - t.position[0], p[1] - t.position[1], p[2] - t.position[2]];
  const m = t.rotation;
  return [0, 3, 6].map((k) => (m[k]! * d[0] + m[k + 1]! * d[1] + m[k + 2]! * d[2]) / t.scale) as unknown as Vec3;
}

/** A way in a thing (its axes) as its parent has it: turned only. */
export const directionToWorld = (t: Transform, d: Vec3): Vec3 => turn(t.rotation, d);
/** A way in a thing's parent, in the thing's own axes. */
export const directionToLocal = (t: Transform, d: Vec3): Vec3 => turnBack(t.rotation, d);

/** A thing's world transform from its parent's and its own local one (the parent's applied to it). */
export function compose(parent: Transform, local: Transform): Transform {
  return {
    position: pointToWorld(parent, local.position),
    rotation: multiply(parent.rotation, local.rotation),
    scale: parent.scale * local.scale,
  };
}

/** A transform undone: what takes its parent's points back into it. */
export function invert(t: Transform): Transform {
  const rotation = transpose(t.rotation);
  const back = turn(rotation, t.position);
  return {
    position: [-back[0] / t.scale, -back[1] / t.scale, -back[2] / t.scale],
    rotation,
    scale: 1 / t.scale,
  };
}

/** A thing's local transform that puts it at `world`, its parent at `parentWorld`: an edit made in the world taken back into the thing's parent. */
export function toLocal(parentWorld: Transform, world: Transform): Transform {
  return compose(invert(parentWorld), world);
}

/**
 * The turn that takes a vector from one frame (`from`, its axes in the world) into another (`to`):
 * toᵀ·from. Exactly none (`IDENTITY`) where the two frames are the same, number for number, so
 * a body seen from the scene's own camera is drawn exactly as it always was.
 */
export function turnInto(to: Mat3, from: Mat3): Mat3 {
  let same = true;
  for (let i = 0; i < 9 && same; i++) same = to[i] === from[i];
  return same ? IDENTITY : multiply(transpose(to), from);
}

/**
 * A body's placement frame: the billboard frame (`bodyFrame`) of a body at `position` as the
 * scene's own camera (`layout`) sees it. Fixed in the world: a function of where the body is,
 * never of the camera drawing it.
 */
export function placementFrame(position: Vec3, layout: Viewpoint): Float32Array {
  return bodyFrame(position, 1, layout.eye, viewUp(layout)).axes;
}

/** A vector at length 1 (none: none). */
const unit = (v: Vec3): Vec3 | null => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l ? [v[0] / l, v[1] / l, v[2] / l] : null;
};

/** A turn about unit `k` by the angle whose cosine and sine are `c` and `s`: v c + (k × v) s + k (k · v)(1 - c). */
function aboutBy(k: Vec3, c: number, s: number): Mat3 {
  const t = 1 - c;
  // Column by column: the images of x, y and z.
  return [
    c + k[0] * k[0] * t, k[1] * k[0] * t + k[2] * s, k[2] * k[0] * t - k[1] * s,
    k[0] * k[1] * t - k[2] * s, c + k[1] * k[1] * t, k[2] * k[1] * t + k[0] * s,
    k[0] * k[2] * t + k[1] * s, k[1] * k[2] * t - k[0] * s, c + k[2] * k[2] * t,
  ];
}

/** A turn about `axis` (any length) by `degrees`, right-handed (anticlockwise seen from where it points). None: exactly no turn. */
export function about(axis: Vec3, degrees: number): Mat3 {
  const k = unit(axis);
  if (!k || !degrees) return IDENTITY;
  const a = (degrees * Math.PI) / 180;
  return aboutBy(k, Math.cos(a), Math.sin(a));
}

/** A turn as a unit quaternion: x, y, z (its axis times the sine of half its angle), w (the cosine of half). */
export type Quat = readonly [number, number, number, number];

/** No turn, as a quaternion. */
export const NO_QUAT: Quat = [0, 0, 0, 1];

/** A quaternion's turn (any length: made unit). No turn exactly none (`IDENTITY`). */
export function quatTurn(q: Quat): Mat3 {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!l || (q[0] === 0 && q[1] === 0 && q[2] === 0)) return IDENTITY;
  const [x, y, z, w] = [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  // Column by column: the images of x, y and z.
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
}

/** A turn as a unit quaternion (its w kept at least 0). */
export function turnQuat(m: Mat3): Quat {
  const [m00, m10, m20, m01, m11, m21, m02, m12, m22] = Array.from({ length: 9 }, (_, i) => m[i]!);
  const t = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  return q[3] < 0 ? [-q[0], -q[1], -q[2], -q[3]] : q;
}

/**
 * A body's own turn, its surfaces' from its frame (its placement frame for a surface fixed in the
 * world, its frame facing the eye for a billboard): its pose, its base turn (`base`, none: none)
 * then turned about its Axis (`axis`, the line it spins about, in that frame; none: its data's
 * pole, `pole`, where its textures' poles are as the game has them) by its Turn (`turn`,
 * degrees). The Axis only says what the Turn turns about: an editor changing it changes the base
 * turn with it so the body stays as it is (`poseKept`). With no Turn and no base turn it is
 * exactly no turn, so the body looks as it always did.
 */
export function bodyTurn(pole: Vec3, axis?: Vec3, turnBy?: number, base?: Quat): Mat3 {
  const spin = turnBy ? about(axis ?? pole, turnBy) : IDENTITY;
  const from = base ? quatTurn(base) : IDENTITY;
  return from === IDENTITY ? spin : spin === IDENTITY ? from : multiply(spin, from);
}

/**
 * The base turn that keeps a body's pose (`bodyTurn`) as it is when its Axis or Turn change from
 * `before` to `after`: B' = R(axis', turn')ᵀ · R(axis, turn) · B. None where it would be none.
 */
export function poseKept(
  pole: Vec3,
  before: { readonly axis?: Vec3; readonly turn?: number; readonly base?: Quat },
  after: { readonly axis?: Vec3; readonly turn?: number },
): Quat | undefined {
  const pose = bodyTurn(pole, before.axis, before.turn, before.base);
  const spin = bodyTurn(pole, after.axis, after.turn);
  const base = spin === IDENTITY ? pose : multiply(transpose(spin), pose);
  return base === IDENTITY ? undefined : turnQuat(base);
}

/**
 * Every thing's world transform, its parents' first: its parent's world transform applied to its
 * local one; a `layout` turn is its placement frame where it ends up. Things whose parent isn't
 * among them hang from the world itself.
 */
export function resolveWorld(nodes: readonly SceneNode[], layout: Viewpoint): Map<string, Transform> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, Transform>();
  const resolve = (node: SceneNode, seen: ReadonlySet<string>): Transform => {
    const done = out.get(node.id);
    if (done) return done;
    const parentNode = node.parent === null ? undefined : byId.get(node.parent);
    const parent = parentNode && !seen.has(parentNode.id) ? resolve(parentNode, new Set([...seen, node.id])) : IDENTITY_TRANSFORM;
    const { local } = node;
    const position = pointToWorld(parent, local.position);
    const world: Transform = {
      position,
      rotation: local.rotation === 'layout' ? placementFrame(position, layout) : multiply(parent.rotation, local.rotation),
      scale: parent.scale * local.scale,
    };
    out.set(node.id, world);
    return world;
  };
  for (const n of nodes) resolve(n, new Set());
  return out;
}

/** A body's world transform: where it is, its placement frame, its radius. */
export function bodyTransform(body: { readonly position: Vec3; readonly radius: number }, layout: Viewpoint): Transform {
  return { position: body.position, rotation: placementFrame(body.position, layout), scale: body.radius };
}

/**
 * The frames one draw of a body is drawn in: its square's (`quad`: facing the eye that draws it,
 * the live `BodyFrame`), and its surface's (`frame`): the square's own for a surface facing the
 * camera, else fixed in the world, the body's placement frame; either turned by the body's own
 * turn (its Axis and Turn: `bodyTurn`; a halo's: none). With them, what
 * the shader takes in the surface's frame: the turn from the square's frame into it (`surface`),
 * the eye (in the body's radii), the view's right and up; and the turns that take what lights it
 * into it: its lights' directions and places (`lightTurn`), and its leans (`leanTurn`: into the
 * square's frame, the view's, which the rims and glows lean across). A draw fixed in the world is
 * lit as placed in the body's placement frame (its lights stay where they are as the camera goes
 * round); one facing the camera is lit in the square's frame, as the game's billboards are (its
 * whole look, its lighting too, kept to the eye; its Turn turns its textures, not its light).
 * Seen from the scene's own camera, every turn is exactly none and every value as it always was.
 */
export interface DrawFrames {
  readonly quad: Mat3;
  readonly frame: Mat3;
  readonly surface: Mat3;
  readonly eye: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly lightTurn: Mat3;
  readonly leanTurn: Mat3;
}

/** What `drawFrames` works from: a body's frames, where it is, the eye drawing it and the view's right and up there. */
export interface DrawFramesOf {
  /** Its placement frame (`placementFrame`). */
  readonly placement: Mat3;
  /** Its frame facing the eye drawing it (`bodyFrame` from the live camera). */
  readonly quad: BodyFrame;
  readonly centre: Vec3;
  readonly radius: number;
  /** The eye drawing it, in the world. */
  readonly eye: Vec3;
  /** The view's right and up on the screen, in the world. */
  readonly viewRight: Vec3;
  readonly viewUp: Vec3;
  readonly orientation: Orientation;
  /** The body's own turn as this draw takes it (`bodyTurn`; none: none). */
  readonly turn?: Mat3;
}

/**
 * A body's surface frame for an orientation: the square's own facing the camera, else its
 * placement frame; turned by the body's own turn (`bodyTurn`) where it takes it.
 */
export function surfaceFrame(placement: Mat3, quad: Mat3, orientation: Orientation, bodyTurned: Mat3 = IDENTITY): Mat3 {
  const base = orientation === 'camera' ? quad : placement;
  return bodyTurned === IDENTITY ? base : multiply(base, bodyTurned);
}

/** The frames of one draw of a body (see `DrawFrames`). */
export function drawFrames(o: DrawFramesOf): DrawFrames {
  const quad = o.quad.axes;
  const frame = surfaceFrame(o.placement, quad, o.orientation, o.turn);
  // What its lights are set in: the placement frame for a surface fixed in the world, the square's facing the eye.
  const lit = o.orientation === 'camera' ? quad : o.placement;
  const surface = turnInto(frame, quad);
  const to: Vec3 = [o.eye[0] - o.centre[0], o.eye[1] - o.centre[1], o.eye[2] - o.centre[2]];
  const eye =
    surface === IDENTITY ? o.quad.eye : (turnBack(frame, to).map((v) => v / o.radius) as unknown as Vec3);
  return {
    quad,
    frame,
    surface,
    eye,
    right: turnBack(frame, o.viewRight),
    up: turnBack(frame, o.viewUp),
    lightTurn: turnInto(frame, lit),
    leanTurn: turnInto(quad, lit),
  };
}
