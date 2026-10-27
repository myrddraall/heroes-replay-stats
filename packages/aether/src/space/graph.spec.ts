import { describe, expect, it } from 'vitest';
import {
  type MoonChoices,
  orbitOffset,
  orbitTo,
  placeBodies,
  type PlanetChoices,
} from '../scenes/scene-settings';
import { groupBodies, groupTransform, SCENE_CENTRE } from '../scenes/scene-bodies';
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
  resolveWorld,
  type SceneNode,
  toLocal,
  type Transform,
  transpose,
  turn,
  turnInto,
  type Vec3,
} from './graph';
import { bodyFrame, viewMatrix, viewUp, type Viewpoint } from './space';

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

  it("puts a group's planets and their moons where the scene's builders put them, number for number", () => {
    const moons: MoonChoices[] = [
      { id: 'moon', orbit: { radius: 2.4, tilt: 12, turn: 30, progress: 0.9, size: 0.27 } },
    ];
    const group: PlanetChoices = {
      group: true,
      bodies: [{ id: 'a', position: [10, 75, -3], radius: 6, moons }],
    };
    const placement = { group: 'group-1', position: [-20, 90, 8] as Vec3, size: 1.5, turn: 35 };
    const [built] = groupBodies([placement], () => group);
    const nodes: SceneNode[] = [
      { id: 'group', kind: 'group', parent: null, local: groupTransform(placement) },
      {
        id: 'a',
        kind: 'planet',
        parent: 'group',
        local: {
          // In a group, relative to its middle.
          position: [
            10 - SCENE_CENTRE.position[0],
            75 - SCENE_CENTRE.position[1],
            -3 - SCENE_CENTRE.position[2],
          ],
          rotation: 'layout',
          scale: 6,
        },
      },
      {
        id: 'moon',
        kind: 'moon',
        parent: 'a',
        local: { position: orbitOffset(moons[0]!.orbit), rotation: 'layout', scale: 0.27 },
      },
    ];
    const world = resolveWorld(nodes, LAYOUT);
    const planet = world.get('a')!;
    expect(planet.position).toEqual(built!.body.position);
    expect(planet.scale).toBe(built!.body.radius);
    // Its turn is its placement frame where it ends up: the group's turn moves it, never turns it.
    expect(Array.from(planet.rotation)).toEqual(
      Array.from(placementFrame(planet.position, LAYOUT)),
    );
    const [, moon] = placeBodies(
      { position: planet.position, radius: planet.scale },
      moons,
      LAYOUT,
    );
    expect(world.get('moon')!.position).toEqual(moon!.position);
    expect(world.get('moon')!.scale).toBe(moon!.radius);
  });

  it('nests groups as the builder does (within rounding)', () => {
    const inner: PlanetChoices = {
      group: true,
      bodies: [{ id: 'b', position: [5, 70, 0], radius: 3 }],
    };
    const outer: PlanetChoices = {
      group: true,
      groups: [{ group: 'inner', position: [8, 60, 2], size: 0.5, turn: -20 }],
    };
    const groups = (id: string) => (id === 'inner' ? inner : outer);
    const [b] = groupBodies([{ group: 'outer', position: [0, 80, 10], size: 2, turn: 45 }], groups);
    // By hand: the inner group's placement within the outer's, then the outer's in the scene.
    const inGroup = (p: Vec3): Vec3 => [
      p[0] - SCENE_CENTRE.position[0],
      p[1] - SCENE_CENTRE.position[1],
      p[2] - SCENE_CENTRE.position[2],
    ];
    const outerT = groupTransform({ group: 'outer', position: [0, 80, 10], size: 2, turn: 45 });
    const innerT = groupTransform({ group: 'inner', position: [8, 60, 2], size: 0.5, turn: -20 });
    const want = pointToWorld(outerT, inGroup(pointToWorld(innerT, inGroup([5, 70, 0]))));
    expectNear(b!.body.position, want);
    expect(b!.body.radius).toBeCloseTo(3, 12);
  });

  it('finds the orbit back that places a moon where it is (untilted on the screen)', () => {
    const root = { position: [12, 66, 3] as Vec3, radius: 9 };
    const orbit = { radius: 2.2, tilt: 25, turn: 0, progress: 0.3, size: 0.2 };
    const [, moon] = placeBodies(root, [{ id: 'm', orbit }], LAYOUT);
    const found = orbitTo(root, moon!, LAYOUT);
    const [, again] = placeBodies(root, [{ id: 'm', orbit: found }], LAYOUT);
    // (Its frames are 32-bit floats.)
    expectNear(again!.position, moon!.position, 5);
    expect(found.size).toBeCloseTo(0.2, 12);
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
