import { describe, expect, it } from 'vitest';
import {
  about as aboutBy,
  bodyTurn,
  compose,
  NO_QUAT,
  poseKept,
  quatTurn,
  turnQuat,
  drawFrames,
  drawTurnOf,
  IDENTITY,
  invert,
  multiply,
  orientationOf,
  placementFrame,
  pointToLocal,
  pointToWorld,
  toLocal,
  type Transform,
  transpose,
  turn,
  turnInto,
} from './graph';
import { bodyFrame, viewMatrix, viewUp, type Viewpoint } from './space';
import type { Vec3 } from './vectors';

/** The game's camera, as the Play scene's file has it: the scene's own. */
const LAYOUT: Viewpoint = {
  eye: [-0.0018, -41.1988, 5.6051],
  forward: [1.9e-5, 0.999687, -0.025004],
  up: [0, 0, 1],
};
/** Another camera, off to the side and above. */
const OTHER: Viewpoint = { eye: [60, 10, 40], forward: [-0.55, 0.6, -0.35], up: [0, 0, 1] };

const expectNear = (got: ArrayLike<number>, want: ArrayLike<number>, digits = 9) => {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) expect(got[i]).toBeCloseTo(want[i]!, digits);
};

/** A turn about an axis (unit) by an angle, column by column. */
function about(axis: Vec3, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [x, y, z] = axis;
  const k = 1 - c;
  return transpose([
    c + x * x * k,
    x * y * k - z * s,
    x * z * k + y * s,
    y * x * k + z * s,
    c + y * y * k,
    y * z * k - x * s,
    z * x * k - y * s,
    z * y * k + x * s,
    c + z * z * k,
  ]);
}

const PARENT: Transform = {
  position: [3, -2, 7],
  rotation: about([0.48, 0.6, 0.64], 0.9),
  scale: 2.5,
};
const LOCAL: Transform = {
  position: [-1, 0.5, 2],
  rotation: about([0, 0.6, 0.8], -0.4),
  scale: 0.3,
};

describe('the scene graph', () => {
  it("composes a thing's local transform with its parent's, and undoes it", () => {
    const world = compose(PARENT, LOCAL);
    const p: Vec3 = [0.2, -0.7, 1.1];
    // A point through the composed transform is the point through the local, then the parent.
    expectNear(pointToWorld(world, p), pointToWorld(PARENT, pointToWorld(LOCAL, p)));
    expectNear(pointToLocal(world, pointToWorld(world, p)), p);
    // Undone: back where it was; the local transform found from the world one.
    const back = compose(world, invert(world));
    expectNear(back.position, [0, 0, 0]);
    expectNear(back.rotation, IDENTITY);
    expect(back.scale).toBeCloseTo(1, 12);
    const local = toLocal(PARENT, world);
    expectNear(local.position, LOCAL.position);
    expectNear(local.rotation, LOCAL.rotation);
    expect(local.scale).toBeCloseTo(LOCAL.scale, 12);
  });

  it('turns from one frame into another, exactly not at all between the same frame', () => {
    const a = placementFrame([20, 70, 9], LAYOUT);
    expect(turnInto(a, Float32Array.from(a))).toBe(IDENTITY);
    const b = bodyFrame([20, 70, 9], 7.5, OTHER.eye, viewUp(OTHER)).axes;
    const t = turnInto(b, a);
    // A way in frame a, turned into b, is the same way in the world.
    const v: Vec3 = [0.3, -0.5, 0.8];
    expectNear(turn(b, turn(t, v)), turn(a, v), 6);
  });

  it('turns a body about its Axis by its Turn: no Turn exactly no turn, whatever its Axis', () => {
    // Azeroth's textures' pole, 31° off straight up.
    const pole: Vec3 = [-0.51721, 0.00045, 0.85586];
    expect(bodyTurn(pole)).toBe(IDENTITY);
    expect(bodyTurn(pole, pole, 0)).toBe(IDENTITY);
    expect(bodyTurn(pole, [0.3, -0.4, 0.8])).toBe(IDENTITY);
    // About the data's pole where no Axis is set, else about the Axis; right-handed.
    expectNear(bodyTurn(pole, undefined, 90), aboutBy(pole, 90));
    expectNear(bodyTurn(pole, [0, 0, 1], 90), aboutBy([0, 0, 1], 90));
    expectNear(turn(aboutBy([0, 0, 1], 90), [1, 0, 0]), [0, 1, 0]);
    // Its Axis stays where it is.
    const axis: Vec3 = [0.3, -0.4, 0.8];
    expectNear(turn(bodyTurn(pole, axis, 70), axis), axis);
    const a = bodyTurn(pole, axis, 70);
    expectNear(multiply(transpose(a), a), IDENTITY);
  });

  it("keeps a body's pose as its Axis moves at any Turn, its Turn then turning about the new Axis", () => {
    const pole: Vec3 = [-0.51721, 0.00045, 0.85586];
    const a: Vec3 = [0.3, -0.4, 0.8];
    const b: Vec3 = [-0.6, 0.2, 0.5];
    expect(quatTurn(NO_QUAT)).toBe(IDENTITY);
    expect(bodyTurn(pole, a, 0, NO_QUAT)).toBe(IDENTITY);
    for (const turnBy of [0, 40, -130]) {
      const before = { axis: a, turn: turnBy };
      const base = poseKept(pole, before, { axis: b, turn: turnBy });
      expectNear(bodyTurn(pole, b, turnBy, base), bodyTurn(pole, a, turnBy), 12);
      // From there its Turn turns about the new Axis.
      expectNear(
        bodyTurn(pole, b, turnBy + 30, base),
        multiply(aboutBy(b, 30), bodyTurn(pole, a, turnBy)),
        12,
      );
      // And again: an Axis moved twice keeps it still.
      const again = poseKept(pole, { axis: b, turn: turnBy, base }, { axis: pole, turn: turnBy });
      expectNear(bodyTurn(pole, undefined, turnBy, again), bodyTurn(pole, a, turnBy), 12);
    }
    // No Turn, no base turn: none kept.
    expect(poseKept(pole, { axis: a }, { axis: b })).toBeUndefined();
    // A turn and its quaternion, both ways.
    const m = aboutBy([0.2, 0.9, -0.3], 155);
    expectNear(quatTurn(turnQuat(m)), m, 12);
  });

  it("gives a draw's frames: from the scene's camera no turns at all, whichever way it is turned", () => {
    const position: Vec3 = [-48.249, 64.647, 25.444];
    const view = viewMatrix(LAYOUT.eye, LAYOUT.forward, LAYOUT.up);
    for (const orientation of ['camera', 'world'] as const) {
      const f = drawFrames({
        placement: placementFrame(position, LAYOUT),
        quad: bodyFrame(position, 27.25, LAYOUT.eye, viewUp(LAYOUT)),
        centre: position,
        radius: 27.25,
        eye: LAYOUT.eye,
        viewRight: [view[0]!, view[4]!, view[8]!],
        viewUp: [view[1]!, view[5]!, view[9]!],
        orientation,
      });
      expect(f.surface).toBe(IDENTITY);
      expect(f.lightTurn).toBe(IDENTITY);
      expect(f.leanTurn).toBe(IDENTITY);
    }
  });

  it('lights a world draw fixed in the world, a billboard kept to the eye, from another camera', () => {
    const position: Vec3 = [22, 70, 9];
    const placement = placementFrame(position, LAYOUT);
    const frames = (camera: Viewpoint, orientation: 'camera' | 'world') => {
      const view = viewMatrix(camera.eye, camera.forward, camera.up);
      return drawFrames({
        placement,
        quad: bodyFrame(position, 7.5, camera.eye, viewUp(camera)),
        centre: position,
        radius: 7.5,
        eye: camera.eye,
        viewRight: [view[0]!, view[4]!, view[8]!],
        viewUp: [view[1]!, view[5]!, view[9]!],
        orientation,
        turn: bodyTurn([0, 0, 1], [0.2, -0.1, 0.95], 30),
      });
    };
    const light: Vec3 = [-0.4, -0.6, 0.7];
    const world = frames(OTHER, 'world');
    expectNear(turn(world.frame, turn(world.lightTurn, light)), turn(placement, light), 6);
    // A billboard's lights in its frame facing the eye, its Turn turning its textures, not them.
    const camera = frames(OTHER, 'camera');
    expectNear(turn(camera.frame, turn(camera.lightTurn, light)), turn(camera.quad, light), 6);
    expect(camera.leanTurn).toBe(IDENTITY);
    expect(Array.from(frames(OTHER, 'world').frame)).toEqual(
      Array.from(frames(LAYOUT, 'world').frame),
    );
    expect(Array.from(frames(OTHER, 'camera').frame)).not.toEqual(
      Array.from(frames(LAYOUT, 'camera').frame),
    );
  });

  it("turns a draw by its body's own turn, as a billboard from the eye that draws it, or fixed in the world", () => {
    const position: Vec3 = [22, 70, 9];
    const placement = placementFrame(position, LAYOUT);
    const own = bodyTurn([0, 0, 1], [0.3, -0.2, 0.9], 50);
    for (const camera of [LAYOUT, OTHER]) {
      const view = viewMatrix(camera.eye, camera.forward, camera.up);
      const quad = bodyFrame(position, 7.5, camera.eye, viewUp(camera));
      const of = (orientation: 'camera' | 'world', t?: typeof own) =>
        drawFrames({
          placement,
          quad,
          centre: position,
          radius: 7.5,
          eye: camera.eye,
          viewRight: [view[0]!, view[4]!, view[8]!],
          viewUp: [view[1]!, view[5]!, view[9]!],
          orientation,
          ...(t ? { turn: t } : {}),
        });
      expectNear(of('camera', own).frame, multiply(quad.axes, own), 6);
      expectNear(of('world', own).frame, multiply(placement, own), 6);
      // A halo (no turn) square to the eye.
      expect(Array.from(of('camera').frame)).toEqual(Array.from(quad.axes));
    }
  });

  it('leaves a halo square to the camera unless its part or material says otherwise', () => {
    expect(drawTurnOf(undefined, undefined, true, 'world')).toEqual({
      orientation: 'camera',
      turned: false,
    });
    expect(drawTurnOf(undefined, undefined, false, 'world')).toEqual({
      orientation: 'world',
      turned: true,
    });
    expect(drawTurnOf(undefined, 'world', true, 'camera')).toEqual({
      orientation: 'world',
      turned: true,
    });
    expect(drawTurnOf('camera', 'world', true, 'world')).toEqual({
      orientation: 'camera',
      turned: true,
    });
    expect(drawTurnOf(undefined, undefined, false)).toEqual({
      orientation: 'camera',
      turned: true,
    });
  });

  it('turns each draw as its material says, else its part, else its body, else its tuning, else facing the camera', () => {
    expect(orientationOf()).toBe('camera');
    expect(orientationOf(undefined, undefined, undefined, 'world')).toBe('world');
    expect(orientationOf(undefined, undefined, 'world', 'camera')).toBe('world');
    expect(orientationOf(undefined, 'camera', 'world')).toBe('camera');
    expect(orientationOf('world', 'camera', 'camera', 'camera')).toBe('world');
  });
});
