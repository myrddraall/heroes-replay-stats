import { describe, expect, it } from 'vitest';
import type { DataTexture } from 'three/webgpu';
import type { SceneMaterial } from '../../formats/play-scene';
import { UniformSet } from '../uniforms/uniforms';
import {
  gridUniforms,
  lightUniforms,
  materialUniforms,
  shadeUniforms,
} from '../uniforms/draw-uniforms';
import {
  gridFields,
  type MaterialSettings,
  materialValues,
  mergeSettings,
} from '../../materials/material-settings';
import { type AddedLight, bodyDarkenings, withAddedLights } from '../../lights/lights';
import { DEFAULT_SHADE, type PlanetLight } from '../../formats/planet-files';
import { rimTurn } from '../../space/directions';
import { bodyFrame, viewMatrix, viewUp, type Viewpoint } from '../../space/space';
import {
  about,
  bodyTurn,
  drawFrames,
  IDENTITY,
  type Mat3,
  type Orientation,
  placementFrame,
  poseKept,
  turn,
} from '../../space/graph';
import { type BodyLeans, setBodyFrames } from './body-frames';
import { DrawValues } from '../uniforms/shader-uniforms';
import { type Vec3 } from '../../space/vectors';

/** The game's camera, as the Play scene's file has it. */
const CAMERA: Viewpoint = {
  eye: [-0.0018, -41.1988, 5.6051],
  forward: [1.9e-5, 0.999687, -0.025004],
  up: [0, 0, 1],
};

/** The Play screen's shield, as the nexus style has it. */
const SHIELD: SceneMaterial = {
  blend: 'alphaAdd',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  priority: 0,
  emissiveBlend: 'mod',
  diffuse: { color: [64, 13, 255, 255], brightMult: 1 },
  emissive: {
    texture: 'storm-lootui-grid-diff',
    channel: 'g',
    brightMult: 1,
    midtone: 0.4,
    offset: [0, 0],
    angle: 0,
    tiling: [6, 3],
    wrap: [true, true],
    fresnel: { type: 1, exponent: 3, min: 0.1, max: 1, yaw: -0.2618, pitch: -0.2618 },
  },
  alphaMasks: [
    {
      texture: 'mask',
      channel: 'r',
      brightMult: 1,
      midtone: 1,
      offset: [0, 0],
      angle: 0,
      tiling: [1, 1],
      wrap: [false, false],
    },
  ],
} as unknown as SceneMaterial;
const SHIELD_TUNING: MaterialSettings = {
  spread: 0.6,
  scale: 2.5,
  width: 0.08,
  soft: 0.3,
  glow: 2.5,
};

/** Where the data's textures' poles are: the Play screen's planets' (play-large's), Azeroth's (31° off straight up). */
const PLAY_POLE: Vec3 = [0.25882, 0, 0.96593];
const AZEROTH_POLE: Vec3 = [-0.51721, 0.00045, 0.85586];

/** The Play screen's planets where the game puts them, with their shields' settings. */
const PLAY: readonly { id: string; position: Vec3; radius: number; settings: MaterialSettings }[] =
  [
    {
      id: 'play-large',
      position: [-48.249, 64.647, 25.444],
      radius: 27.25,
      settings: {
        strength: 0.63,
        falloff: 1.3,
        scale: 1,
        spread: 0.1,
        spreadFrom: [0.25, -0.933, -0.2588],
        glow: 1,
        drawAs: 'texture',
      },
    },
    {
      id: 'play-medium',
      position: [37.282, 64.892, 14.189],
      radius: 9.037,
      settings: {
        strength: 0.504,
        falloff: 1.3,
        scale: 1.5,
        spread: 0.2,
        spreadFrom: [-0.4532, -0.7849, -0.4226],
        glow: 1,
        drawAs: 'texture',
      },
    },
    {
      id: 'play-small',
      position: [27.752, 53.789, 7.471],
      radius: 1.566,
      settings: {
        strength: 0.504,
        falloff: 1.3,
        scale: 6,
        spread: 0.2,
        spreadFrom: [-0.4532, -0.7849, -0.4226],
        glow: 1,
        drawAs: 'texture',
      },
    },
  ];

/** Korhal's rig, and a lit material of it. */
const RIG: PlanetLight = {
  ambient: [0.02745, 0.05882, 0.14118],
  directional: [
    { direction: [-0.83237, -0.17155, -0.527], color: [0, 0, 0] },
    { direction: [0.93039, -0.15015, -0.33441], color: [0.376, 0.20201, 0.376] },
    { direction: [0.70717, -0.46679, -0.53105], color: [1.11658, 1.75313, 2.661] },
  ],
  exposure: 1.5,
};
const GROUND: SceneMaterial = {
  ...SHIELD,
  blend: 'opaque',
  unshaded: false,
  emissive: {
    ...SHIELD.emissive!,
    fresnel: { type: 1, exponent: 2, min: 0, max: 1, yaw: 0.3, pitch: -0.1 },
  },
} as SceneMaterial;

/** Lights of every kind added to a body: from a side, a point, a spot (aimed and looking at the body), a rim, above and below, the sky, and darkening ones. */
const ADDED: readonly AddedLight[] = [
  {
    id: 'added-dir',
    kind: 'directional',
    name: 'Side',
    from: [-0.4, -0.6, 0.7],
    colour: '#ffeecc',
    strength: 1.2,
  },
  {
    id: 'added-point',
    kind: 'point',
    name: 'Point',
    position: [1.4, -1.1, 0.9],
    colour: '#88aaff',
    strength: 0.6,
  },
  {
    id: 'added-spot',
    kind: 'spot',
    name: 'Spot',
    position: [0.3, -2.4, 1.6],
    aim: [0, 1, -0.4],
    cone: 20,
    colour: '#ff8844',
  },
  {
    id: 'added-look',
    kind: 'spot',
    name: 'Look',
    position: [-1.5, -1.8, -0.4],
    lookAt: { kind: 'body', at: [0.2, 0, 0.3] },
    colour: '#ffffff',
  },
  {
    id: 'added-rim',
    kind: 'rim',
    name: 'Rim',
    from: [0.5, -0.3, 0.8],
    colour: '#66ccff',
    strength: 0.8,
  },
  {
    id: 'added-hemi',
    kind: 'hemisphere',
    name: 'Hemi',
    from: [0.2, 0.1, 1],
    colour: '#334466',
    ground: '#110800',
  },
  { id: 'added-sky', kind: 'environment', name: 'Sky', colour: '#ffffff', strength: 0.3 },
  {
    id: 'added-anti',
    kind: 'directional',
    name: 'Anti',
    darkens: true,
    from: [0.6, -0.2, -0.7],
    strength: 0.5,
  },
  {
    id: 'added-dark-rim',
    kind: 'rim',
    name: 'Dark rim',
    darkens: true,
    from: [-0.7, -0.2, -0.4],
    strength: 0.4,
  },
  {
    id: 'added-dark-point',
    kind: 'point',
    name: 'Dark point',
    darkens: true,
    position: [-1.2, -0.8, -1],
    strength: 0.5,
  },
];
const LIT = {
  position: [22, 70, 9] as Vec3,
  radius: 7.5,
  rim: [0.35, -0.8, 0.45] as Vec3,
  spreadFrom: [-0.3, -0.7, 0.6] as Vec3,
};

const shieldSettings = (settings: MaterialSettings) => mergeSettings(SHIELD_TUNING, settings);

/** A Play screen planet's shield's uniforms, as the renderer works them out once. */
function shieldSet(settings: MaterialSettings): UniformSet {
  const merged = shieldSettings(settings);
  const u = new UniformSet();
  materialUniforms(u, SHIELD, merged?.scale ?? 1, 'alphaAdd', () => true, merged?.spreadFrom);
  u.v2('uRimTurn', [0, 0]);
  const { reveal, activation } = gridFields(materialValues(SHIELD, merged));
  gridUniforms(u, reveal, activation, merged?.inactive, '#ffffff', 1);
  return u;
}

/** The lit body's ground's uniforms, as the renderer works them out once. */
function litSet(): UniformSet {
  const u = new UniformSet();
  materialUniforms(u, GROUND, 1, 'opaque', () => true, LIT.spreadFrom);
  const shade = { ...DEFAULT_SHADE, strength: 0.4 };
  lightUniforms(u, withAddedLights(RIG, ADDED, undefined, 1.5, shade), 1.5);
  u.v2('uRimTurn', rimTurn(LIT.rim));
  shadeUniforms(u, bodyDarkenings(RIG, shade, ADDED, undefined));
  return u;
}

/** A vector in a frame (its axes column-major), from the world. */
const intoFrame = (axes: ArrayLike<number>, v: Vec3): number[] =>
  [0, 1, 2].map((c) => axes[c * 3]! * v[0] + axes[c * 3 + 1]! * v[1] + axes[c * 3 + 2]! * v[2]);

/** What a draw's values give its shader about where it is seen from and lit from. */
function inputsOf(d: DrawValues) {
  const data = (d.tableTexture as DataTexture).image.data as Float32Array;
  return {
    eye: Array.from(d.vector('uEye')),
    right: Array.from(d.vector('uRight')),
    up: Array.from(d.vector('uUp')),
    reaches: Array.from(data.subarray(0, d.scalar('uReachCount') * 11 * 4)),
    views: [0, 1, 2, 3, 4].map((i) => Array.from(d.vector(`uLayers[${i}].view`))),
  };
}

/**
 * What a body's draw gave its shader as the renderer baked it before bodies had a placement
 * frame (kept to compare against): the eye, the view's right and up in the body's frame facing
 * the camera, the reaches as set.
 */
function billboardInputs(position: Vec3, radius: number, camera: Viewpoint, set: UniformSet) {
  const view = viewMatrix(camera.eye, camera.forward, camera.up);
  const frame = bodyFrame(position, radius, camera.eye, viewUp(camera));
  const d = new DrawValues();
  d.apply(set);
  d.set('uEye', frame.eye);
  d.set('uRight', intoFrame(frame.axes, [view[0]!, view[4]!, view[8]!]));
  d.set('uUp', intoFrame(frame.axes, [view[1]!, view[5]!, view[9]!]));
  return inputsOf(d);
}

/** A body's draw's frames as the renderer bakes it now: placed from the scene's camera, seen from `camera`. */
function framesOf(
  position: Vec3,
  radius: number,
  camera: Viewpoint,
  orientation: Orientation,
  own?: Mat3,
) {
  const view = viewMatrix(camera.eye, camera.forward, camera.up);
  return drawFrames({
    placement: placementFrame(position, CAMERA),
    quad: bodyFrame(position, radius, camera.eye, viewUp(camera)),
    centre: position,
    radius,
    eye: camera.eye,
    viewRight: [view[0]!, view[4]!, view[8]!],
    viewUp: [view[1]!, view[5]!, view[9]!],
    orientation,
    ...(own ? { turn: own } : {}),
  });
}

/** What a body's draw gives its shader as the renderer bakes it now (see `framesOf`), its leans set in its placement frame. */
function placedInputs(
  position: Vec3,
  radius: number,
  camera: Viewpoint,
  set: UniformSet,
  leans: BodyLeans,
  orientation: Orientation = 'camera',
  own?: Mat3,
) {
  const d = new DrawValues();
  d.apply(set);
  const frames = framesOf(position, radius, camera, orientation, own);
  setBodyFrames(d, frames, leans);
  return { frames, d, inputs: inputsOf(d) };
}

const playLeans = (p: (typeof PLAY)[number]): BodyLeans => ({
  spreadFrom: shieldSettings(p.settings)?.spreadFrom,
});
const LIT_LEANS: BodyLeans = { rim: LIT.rim, spreadFrom: LIT.spreadFrom };

/** Another camera: off to the right, above, looking back at the scene's middle. */
const OTHER: Viewpoint = { eye: [60, 10, 40], forward: [-0.55, 0.6, -0.35], up: [0, 0, 1] };
/** And one turned about its up a little (as the site's flies turn it). */
const TURNED: Viewpoint = { eye: CAMERA.eye, forward: [0.2, 0.979, -0.025], up: [0, 0, 1] };

/** The reaches of a draw (each 11 rows of 4): entry i's row r. */
const rowOf = (reaches: readonly number[], i: number, r: number): Vec3 => {
  const at = (i * 11 + r) * 4;
  return [reaches[at]!, reaches[at + 1]!, reaches[at + 2]!];
};

const expectNear = (got: readonly number[], want: readonly number[], digits = 5) =>
  want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, digits));

describe("a body's shading inputs from the scene's own camera", () => {
  for (const p of PLAY)
    it(`are as they were for the Play screen's ${p.id}`, () => {
      const set = shieldSet(p.settings);
      const now = placedInputs(p.position, p.radius, CAMERA, set, playLeans(p));
      expect(now.inputs).toMatchSnapshot();
      expect(now.inputs).toEqual(billboardInputs(p.position, p.radius, CAMERA, set));
    });

  it('are as they were for a body lit from a side, a point, spots, a rim, above and below and the sky', () => {
    const now = placedInputs(LIT.position, LIT.radius, CAMERA, litSet(), LIT_LEANS);
    expect(now.inputs).toMatchSnapshot();
    for (const turnOf of [now.frames.lightTurn, now.frames.leanTurn, now.frames.surface])
      expect(turnOf).toBe(IDENTITY);
  });

  it('are the same for a body fixed in the world, its axis and turn as its data has them, as for its billboard', () => {
    const camera = placedInputs(LIT.position, LIT.radius, CAMERA, litSet(), LIT_LEANS);
    const world = placedInputs(LIT.position, LIT.radius, CAMERA, litSet(), LIT_LEANS, 'world');
    expect(world.inputs).toEqual(camera.inputs);
    expect(Array.from(world.frames.frame)).toEqual(Array.from(camera.frames.frame));
    expect(world.frames.surface).toBe(IDENTITY);
    for (const p of PLAY) {
      const set = shieldSet(p.settings);
      for (const orientation of ['camera', 'world'] as const)
        expect(
          placedInputs(
            p.position,
            p.radius,
            CAMERA,
            set,
            playLeans(p),
            orientation,
            bodyTurn(PLAY_POLE, PLAY_POLE, 0),
          ).inputs,
        ).toEqual(placedInputs(p.position, p.radius, CAMERA, set, playLeans(p)).inputs);
    }
  });

  it("take a body's Axis as its data's pole unless set: its own turn none, as it always was", () => {
    const own = bodyTurn(AZEROTH_POLE);
    expect(own).toBe(IDENTITY);
    const billboard = billboardInputs(LIT.position, LIT.radius, CAMERA, litSet());
    for (const orientation of ['camera', 'world'] as const) {
      const now = placedInputs(
        LIT.position,
        LIT.radius,
        CAMERA,
        litSet(),
        LIT_LEANS,
        orientation,
        own,
      );
      expect(now.inputs).toEqual(billboard);
      expect(now.frames.surface).toBe(IDENTITY);
    }
  });
});

describe("a body's lights from another camera", () => {
  const set = litSet();
  const placement = placementFrame(LIT.position, CAMERA);
  const before = billboardInputs(LIT.position, LIT.radius, CAMERA, set).reaches;
  const count = before.length / 44;
  for (const camera of [OTHER, TURNED]) {
    const seen = camera === OTHER ? 'moved' : 'turned';
    it(`stay where they are in the world for a surface fixed there (${seen})`, () => {
      const { frames, inputs } = placedInputs(
        LIT.position,
        LIT.radius,
        camera,
        set,
        LIT_LEANS,
        'world',
      );
      for (let i = 0; i < count; i++) {
        const rim = before[(i * 11 + 1) * 4 + 3] === 5;
        // Directions and places (and spots' aims) as set, in the world, as the draw has them.
        for (const r of rim ? [0, 3] : [0, 3, 4])
          expectNear(
            turn(frames.frame, rowOf(inputs.reaches, i, r)),
            turn(placement, rowOf(before, i, r)),
          );
      }
    });

    it(`stay with the eye for a billboard, exactly as the game's billboards were lit (${seen})`, () => {
      const now = placedInputs(LIT.position, LIT.radius, camera, set, LIT_LEANS, 'camera');
      expect(now.inputs).toEqual(billboardInputs(LIT.position, LIT.radius, camera, set));
      for (const turnOf of [now.frames.lightTurn, now.frames.leanTurn, now.frames.surface])
        expect(turnOf).toBe(IDENTITY);
    });
  }

  it("lean a world surface's rims as set in the world, turned into the view", () => {
    const { frames, inputs } = placedInputs(
      LIT.position,
      LIT.radius,
      OTHER,
      set,
      LIT_LEANS,
      'world',
    );
    for (let i = 0; i < count; i++) {
      if (before[(i * 11 + 1) * 4 + 3] !== 5) continue;
      const lean = rowOf(before, i, 0).map((v) => -v) as unknown as Vec3;
      const [yaw, pitch] = rimTurn(turn(frames.leanTurn, lean));
      expectNear(rowOf(inputs.reaches, i, 4).slice(0, 2), [-yaw, -pitch]);
    }
  });

  it('keep a surface fixed in the world as the camera goes round, the eye moving round it', () => {
    const a = framesOf(LIT.position, LIT.radius, OTHER, 'world');
    const b = framesOf(LIT.position, LIT.radius, TURNED, 'world');
    expect(Array.from(a.frame)).toEqual(Array.from(b.frame));
    expect(a.eye).not.toEqual(b.eye);
    // The eye in the surface's frame is where the eye is, in the body's radii.
    const back = turn(a.frame, a.eye).map((v, k) => LIT.position[k]! + v * LIT.radius);
    expectNear(back, OTHER.eye, 4);
  });

  it('change nothing for an Axis alone, with no Turn', () => {
    for (const camera of [CAMERA, OTHER])
      for (const orientation of ['camera', 'world'] as const)
        expect(
          placedInputs(
            LIT.position,
            LIT.radius,
            camera,
            set,
            LIT_LEANS,
            orientation,
            bodyTurn(AZEROTH_POLE, [0.3, -0.2, 0.9]),
          ).inputs,
        ).toEqual(
          placedInputs(LIT.position, LIT.radius, camera, set, LIT_LEANS, orientation).inputs,
        );
  });

  it('change nothing as the Axis moves at any Turn (its base turn kept with it)', () => {
    const a: Vec3 = [0.3, -0.2, 0.9];
    const b: Vec3 = [-0.5, 0.3, 0.8];
    for (const turnBy of [40, -120])
      for (const orientation of ['camera', 'world'] as const) {
        const base = poseKept(AZEROTH_POLE, { axis: a, turn: turnBy }, { axis: b, turn: turnBy });
        const was = placedInputs(
          LIT.position,
          LIT.radius,
          OTHER,
          set,
          LIT_LEANS,
          orientation,
          bodyTurn(AZEROTH_POLE, a, turnBy),
        );
        const now = placedInputs(
          LIT.position,
          LIT.radius,
          OTHER,
          set,
          LIT_LEANS,
          orientation,
          bodyTurn(AZEROTH_POLE, b, turnBy, base),
        );
        expectNear(Array.from(now.frames.frame), Array.from(was.frames.frame), 9);
        expectNear(now.inputs.eye, was.inputs.eye, 5);
        expectNear(now.inputs.reaches, was.inputs.reaches, 4);
      }
  });

  it('turn a surface about its set Axis by its Turn, in the world or facing the eye', () => {
    const axis: Vec3 = [0.3, -0.2, 0.9];
    const own = bodyTurn(AZEROTH_POLE, axis, 70);
    const placed = placementFrame(LIT.position, CAMERA);
    const quad = bodyFrame(LIT.position, LIT.radius, OTHER.eye, viewUp(OTHER)).axes;
    for (const [orientation, base] of [
      ['world', placed],
      ['camera', quad],
    ] as const) {
      const f = framesOf(LIT.position, LIT.radius, OTHER, orientation, own).frame;
      // Its Axis where it was; its surface turned about it.
      expectNear(turn(f, axis), turn(base, axis));
      expectNear(turn(f, [1, 0, 0]), turn(base, turn(about(axis, 70), [1, 0, 0])));
    }
  });

  it("keep a turned billboard's lights with the eye: its Turn turns its textures, not its light", () => {
    const own = bodyTurn(AZEROTH_POLE, undefined, 120);
    const turned = placedInputs(LIT.position, LIT.radius, OTHER, set, LIT_LEANS, 'camera', own);
    const plain = placedInputs(LIT.position, LIT.radius, OTHER, set, LIT_LEANS, 'camera');
    for (let i = 0; i < count; i++)
      for (const r of [0, 3])
        expectNear(
          turn(turned.frames.frame, rowOf(turned.inputs.reaches, i, r)),
          turn(plain.frames.frame, rowOf(plain.inputs.reaches, i, r)),
        );
  });

  it('keep a billboard turned by its Turn the same side to the eye as the camera goes round', () => {
    const own = bodyTurn(AZEROTH_POLE, undefined, 120);
    const seen = (camera: Viewpoint) => {
      const { eye } = framesOf(LIT.position, LIT.radius, camera, 'camera', own);
      const l = Math.hypot(...eye);
      return eye.map((v) => v / l);
    };
    expectNear(seen(OTHER), seen(CAMERA));
    expectNear(seen(TURNED), seen(CAMERA));
    // Another side than with no Turn.
    const { eye } = framesOf(LIT.position, LIT.radius, CAMERA, 'camera');
    expect(Math.abs(seen(CAMERA)[0]! - eye[0] / Math.hypot(...eye))).toBeGreaterThan(0.1);
  });
});
