import { describe, expect, it } from 'vitest';
import type { BodyPart, PlanetFile, SceneMaterial } from "@myrddraall/heroes-replay-stats-aether/formats";
import type { BodyLight } from "@myrddraall/heroes-replay-stats-aether/lights";
import { bodyTurn, placementFrame, pointToWorld, turn } from "@myrddraall/heroes-replay-stats-aether/space";
import {
  axisAids,
  type BodyInfo,
  keepingPose,
  lightsView,
  poleAt,
  poleDragged,
  poleMarkers,
  bodyView,
  lightAids,
  lightMarkerAt,
  partsOfBody,
  spotEdges,
  valuesOf,
  materialAt,
  materialsOf,
  offPart,
  onPart,
  sharedMaterials,
  shieldLightsOfBody,
  skyAnchorView,
} from './editor-model';

const material: SceneMaterial = {
  blend: 'alpha',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse: { texture: 'clouds', brightMult: 1 },
  emissive: null,
  alphaMasks: [],
};

const file = (kind: PlanetFile['kind']): PlanetFile =>
  ({
    kind,
    parts: [
      {
        id: 'sphere-1',
        role: 'sphere',
        materials: ['clouds'],
        shape: { kind: 'sphere', radius: 1 },
        mapping: { kind: 'sphere', pole: [0, 0, 1] },
      } as unknown as BodyPart,
    ],
    materials: { clouds: material },
    textures: {},
  }) as PlanetFile;

const korhal = (settings: BodyInfo['settings']): BodyInfo => ({
  key: 'body',
  id: 'korhal',
  overlays: [{ id: '@overlay-1', file: file('style') }],
  overlaysSet: false,
  settings,
  materialBase: { clouds: { scale: 3 } },
  file: file('world'),
  moons: [],
});

describe('editor model', () => {
  it("sets a body's own material and an overlay's of the same name apart", () => {
    const list = materialsOf(
      korhal({
        materials: { clouds: { strength: 2 }, 'style:@overlay-1:clouds': { strength: 4 } },
      }),
    );
    const own = materialAt(list, 'clouds');
    const worn = materialAt(list, 'style:@overlay-1:clouds');
    expect(own?.overlay).toBeUndefined();
    expect(worn?.overlay).toBe('@overlay-1');
    expect(own?.values.strength).toBe(2);
    expect(worn?.values.strength).toBe(4);
    // The material's base settings are both's.
    expect(own?.values.scale).toBe(3);
    expect(worn?.values.scale).toBe(3);
  });

  it('keeps an overlay opened on its own by its key', () => {
    const list = materialsOf({
      ...korhal({ materials: { 'style:@overlay-1:clouds': { strength: 4 } } }),
      id: '@overlay-1',
      overlays: [],
      file: file('style'),
    });
    expect(list.map((m) => m.key)).toEqual(['style:@overlay-1:clouds']);
    expect(list[0]?.values.strength).toBe(4);
  });
});

describe('a material’s rows on parts', () => {
  it('tells apart by part only the materials drawn on more than one part', () => {
    const shared = sharedMaterials([
      { materials: [{ name: 'rock' }, { name: 'glow' }, { name: 'glow' }] },
      { materials: [{ name: 'rock' }] },
      { materials: [{ name: 'sea' }] },
    ]);
    expect([...shared]).toEqual(['rock']);
  });

  it('keeps the material’s name in its key, the part after it', () => {
    const key = onPart('body:0/m/rock', 'own:tube-1');
    expect(key).toBe('body:0/m/rock#own:tube-1');
    expect(offPart(key.slice('body:0/m/'.length))).toBe('rock');
    expect(onPart('body:0/m/rock')).toBe('body:0/m/rock');
    expect(offPart('rock')).toBe('rock');
  });
});

describe('a light’s marker', () => {
  // A body a radius wide at 10 ahead of an eye at the origin looking along +y.
  const body = { id: 'b', position: [0, 10, 0] as const, radius: 1 };
  const view = { eye: [0, 0, 0], forward: [0, 1, 0], up: [0, 0, 1] } as const;

  it('puts a spot’s line along its aim to where it meets the body, past it to its nearest point', () => {
    // Straight in front, aimed at the middle: the line ends at the near surface.
    const at = lightMarkerAt({ kind: 'spot', position: [0, -3, 0] }, body, view)!;
    expect(at.at.map((v) => Math.round(v * 100) / 100)).toEqual([0, 7, 0]);
    expect(at.from!.map((v) => Math.round(v * 100) / 100)).toEqual([0, 9, 0]);
    // Aimed up, past the body: as far as level with its middle.
    const past = lightMarkerAt({ kind: 'spot', position: [0, -3, 2], aim: [0, 1, 0] }, body, view)!;
    expect(past.from!.map((v) => Math.round(v * 100) / 100)).toEqual([0, 10, 2]);
    // A point light's line goes to the nearest of the surface.
    const point = lightMarkerAt({ kind: 'point', position: [0, -3, 2] }, body, view)!;
    expect(Math.hypot(point.from![0], point.from![1] - 10, point.from![2])).toBeCloseTo(1.05);
  });
});

describe('shieldLightsOfBody', () => {
  const shield = (): PlanetFile =>
    ({
      kind: 'style',
      parts: [
        {
          id: 'shield-1',
          role: 'shield',
          materials: ['grid'],
          shape: { kind: 'sphere', radius: 1 },
          mapping: { kind: 'sphere' },
          pattern: { kind: 'hex' },
        } as unknown as BodyPart,
      ],
      materials: { grid: material },
      textures: {},
    }) as PlanetFile;
  const worn = (): BodyInfo => ({
    key: 'body',
    id: 'korhal',
    overlays: [{ id: '@overlay-1', file: shield() }],
    overlaysSet: false,
    settings: {},
    file: file('world'),
    moons: [],
  });

  it("marks a shield's lights under the shield's material row, with the body's own lights", () => {
    const lights = shieldLightsOfBody(worn(), materialsOf(worn()), (name, overlay) =>
      overlay ? `om/${overlay}/${name}` : `m/${name}`,
    );
    expect(lights.map((l) => l.key)).toEqual(['om/@overlay-1/grid::light:added-rim']);
    expect(lights[0]?.light.kind).toBe('rim');
  });

  it('marks nothing where a body has no shield', () => {
    const b = { ...worn(), overlays: [] };
    expect(shieldLightsOfBody(b, materialsOf(b), (name) => name)).toEqual([]);
  });
});

describe('the sky’s anchor as its panel shows it', () => {
  it('is the world where no level sets it', () => {
    expect(skyAnchorView(undefined, undefined)).toEqual({ value: 'world' });
    expect(skyAnchorView({}, {})).toEqual({ value: 'world' });
  });

  it('is the level edited’s, over the one under it (named where it sets it)', () => {
    expect(skyAnchorView({ anchor: 'camera' }, {})).toEqual({
      value: 'camera',
      origin: 'the library (sky)',
    });
    expect(skyAnchorView({ anchor: 'camera' }, { anchor: 'position' })).toEqual({
      value: 'position',
      set: 'position',
      origin: 'the library (sky)',
    });
    expect(skyAnchorView(undefined, { anchor: 'world' })).toEqual({ value: 'world', set: 'world' });
  });
});

describe("a body's orientation", () => {
  it('turns each material as it says, else its part, else the body (the layer edited over those under it), else facing the camera', () => {
    expect(valuesOf(korhal({})).orientation).toBe('camera');
    expect(valuesOf(korhal({})).axis).toEqual([0, 0, 1]);
    // The body's, from the library under the scene: its parts and materials with it.
    const below: BodyInfo = { ...korhal({}), below: { orientation: 'world', axis: [0, 0.3, 1] } };
    expect(valuesOf(below)).toMatchObject({ orientation: 'world', axis: [0, 0.3, 1] });
    expect(bodyView(below, false, true).origins.orientation).toBe('the library (planet)');
    expect(partsOfBody(below)[0]?.values.orientation).toBe('world');
    expect(materialAt(materialsOf(below), 'clouds')?.values.orientation).toBe('world');
    // Each shows where it is said: the body's name.
    expect(partsOfBody(below)[0]?.origins.orientation).toBe('korhal');
    expect(materialAt(materialsOf(below), 'clouds')?.origins.orientation).toBe('korhal');
    // A part set back to the camera: its materials with it, the overlay's (another part) not.
    const part = korhal({ orientation: 'world', parts: { 'own:sphere-1': { orientation: 'camera' } } });
    expect(materialAt(materialsOf(part), 'clouds')?.values.orientation).toBe('camera');
    expect(materialAt(materialsOf(part), 'style:@overlay-1:clouds')?.values.orientation).toBe('world');
    // A material's own say over its part's.
    const own = korhal({
      parts: { 'own:sphere-1': { orientation: 'camera' } },
      materials: { clouds: { orientation: 'world' } },
    });
    expect(materialAt(materialsOf(own), 'clouds')?.values.orientation).toBe('world');
  });

  it("takes its Axis from its data's pole unless set, its Turn 0", () => {
    const pole = [-0.51721, 0.00045, 0.85586] as const;
    const tilted = korhal({});
    const data = tilted.file!;
    const withPole: BodyInfo = {
      ...tilted,
      file: { ...data, parts: data.parts.map((p) => ({ ...p, mapping: { ...p.mapping, pole } }) as BodyPart) },
    };
    expect(valuesOf(withPole)).toMatchObject({ axis: pole, turn: 0 });
    expect(valuesOf({ ...withPole, below: { axis: [0, 0, 1], turn: 30 } })).toMatchObject({ axis: [0, 0, 1], turn: 30 });
    expect(bodyView({ ...withPole, below: { turn: 30 } }, false, true).origins.turn).toBe('the library (planet)');
  });

  it('leaves a halo facing the camera when only its body says World, unless set on it', () => {
    const halo: BodyInfo = {
      ...korhal({ orientation: 'world' }),
      file: {
        ...file('world'),
        materials: { clouds: { ...material, blend: 'add' } },
      },
    };
    expect(partsOfBody(halo)[0]?.values.orientation).toBe('camera');
    expect(partsOfBody(halo)[0]?.origins.orientation).toBeUndefined();
    expect(materialAt(materialsOf(halo), 'clouds')).toMatchObject({ values: { orientation: 'camera' }, turned: false });
    expect(materialAt(materialsOf(halo), 'clouds')?.origins.orientation).toBe('Sphere 1');
    const set = { ...halo, settings: { orientation: 'world' as const, parts: { 'own:sphere-1': { orientation: 'world' as const } } } };
    expect(materialAt(materialsOf(set), 'clouds')).toMatchObject({ values: { orientation: 'world' }, turned: true });
  });
});

describe("a planet's pose", () => {
  it('stays as it is as its Axis is set or reset at a Turn; the Orientation reset takes it all back', () => {
    const b = korhal({ turn: 40 });
    const posed = (s: BodyInfo['settings']) => {
      const v = valuesOf({ ...b, settings: s });
      return bodyTurn([0, 0, 1], v.axis, v.turn, v.baseTurn);
    };
    const moved = keepingPose(b, { ...b.settings, axis: [0.6, 0, 0.8] }, ['axis']);
    expect(moved.baseTurn).toBeDefined();
    Array.from(posed(moved)).forEach((v, i) => expect(v).toBeCloseTo(posed(b.settings)[i]!, 12));
    const back = keepingPose({ ...b, settings: moved }, { turn: 40, baseTurn: moved.baseTurn }, ['axis']);
    Array.from(posed(back)).forEach((v, i) => expect(v).toBeCloseTo(posed(b.settings)[i]!, 12));
    // A Turn reset: back to its base turn; the section's reset: nothing kept.
    expect(keepingPose(b, { axis: [0.6, 0, 0.8] }, ['turn'])).toEqual({ axis: [0.6, 0, 0.8] });
    expect(keepingPose({ ...b, settings: moved }, {}, ['orientation', 'axis', 'turn', 'baseTurn'])).toEqual({});
  });
});

describe("a planet's axis marker", () => {
  const body = { id: 'b', position: [20, 70, 9] as const, radius: 7.5 };
  const layout = { eye: [-0.0018, -41.1988, 5.6051], forward: [1.9e-5, 0.999687, -0.025004], up: [0, 0, 1] } as const;
  const other = { eye: [60, 10, 40], forward: [-0.55, 0.6, -0.35], up: [0, 0, 1] } as const;
  const north = (b: BodyInfo, view: typeof layout | typeof other) => axisAids(b, body, layout, view)[0]!.way;

  it('points along its Axis as its surfaces are drawn: fixed in the world, or turned with the eye', () => {
    const world = korhal({ orientation: 'world', axis: [0, 0.6, 0.8] });
    const frame = placementFrame(body.position, layout);
    north(world, other).forEach((v, k) => expect(v).toBeCloseTo(turn(frame, [0, 0.6, 0.8])[k]!, 5));
    expect(north(world, other)).toEqual(north(world, layout));
    const billboard = korhal({ axis: [0, 0.6, 0.8] });
    expect(north(billboard, other)).not.toEqual(north(billboard, layout));
    // A Turn turns about it: the line stays.
    expect(north(korhal({ orientation: 'world', axis: [0, 0.6, 0.8], turn: 90 }), other)).toEqual(north(world, other));
    // Its poles named at its ends, N where it points, as far past each.
    const [n, s] = poleMarkers(axisAids(world, body, layout, other)[0]!, 'body');
    expect([n?.label, s?.label]).toEqual(['N', 'S']);
    const mid = n!.at.map((v, k) => (v + s!.at[k]!) / 2);
    mid.forEach((v, k) => expect(v).toBeCloseTo(body.position[k]!, 9));
  });

  it('moves its Axis as a pole is dragged, like a globe’s, on the near side, over the edge and behind', () => {
    const world = korhal({ orientation: 'world' });
    const [line] = axisAids(world, body, layout, other);
    const frame = placementFrame(body.position, layout);
    const eye = other.eye as unknown as readonly [number, number, number];
    const unit = (v: readonly number[]) => v.map((x) => x / Math.hypot(...v));
    const rayTo = (p: readonly number[]) => unit(p.map((v, k) => v - eye[k]!)) as unknown as [number, number, number];
    const from = poleAt(line!, true);
    // A point on the sphere through the pole, on the side facing the eye.
    const toEye = unit(eye.map((v, k) => v - body.position[k]!));
    const r = Math.hypot(...from.map((v, k) => v - body.position[k]!));
    const target = body.position.map((v, k) => v + r * unit([toEye[0]! + 0.3, toEye[1]!, toEye[2]! + 0.4])[k]!);
    const north = poleDragged(line!, true, eye, rayTo(target), from, frame);
    north.at.forEach((v, k) => expect(v).toBeCloseTo(target[k]!, 6));
    const way = unit(target.map((v, k) => v - body.position[k]!));
    turn(frame, north.axis).forEach((v, k) => expect(v).toBeCloseTo(way[k]!, 4));
    // The south pole dragged there (from near it): the Axis the other way.
    const south = poleDragged(line!, false, eye, rayTo(target), target as unknown as typeof from, frame);
    turn(frame, south.axis).forEach((v, k) => expect(v).toBeCloseTo(-way[k]!, 4));
    // Past the outline: on its edge, then behind (further from the eye than the middle).
    const side = body.position.map((v, k) => v + 3 * r * unit([toEye[1]!, -toEye[0]!, 0])[k]!);
    const behind = poleDragged(line!, true, eye, rayTo(side), north.at, frame).at;
    const d = (p: readonly number[]) => Math.hypot(...p.map((v, k) => v - eye[k]!));
    expect(d(behind)).toBeGreaterThan(d(body.position));
  });

  it("places a body's lights as it is lit: fixed in the world, or kept to the eye", () => {
    expect(lightsView(korhal({ orientation: 'world' }), layout, other)).toBe(layout);
    expect(lightsView(korhal({}), layout, other)).toBe(other);
    expect(lightsView(undefined, layout, other)).toBe(other);
  });
});

describe("a light's markers and aids", () => {
  const body = { id: 'b', position: [20, 70, 9] as const, radius: 7.5 };
  const layout = { eye: [-0.0018, -41.1988, 5.6051], forward: [1.9e-5, 0.999687, -0.025004], up: [0, 0, 1] } as const;
  const spot: BodyLight = {
    id: 'added-spot',
    kind: 'spot',
    name: 'Spot',
    enabled: true,
    darkens: false,
    colour: '#ffffff',
    strength: 1,
    position: [0.3, -2.4, 1.6],
    aim: [0, 1, -0.4],
    cone: 20,
  } as BodyLight;

  it("are placed in the body's placement frame, the scene's camera's, as the renderer lights it", () => {
    const frame = placementFrame(body.position, layout);
    expect(lightMarkerAt(spot, body, layout)!.at).toEqual(
      pointToWorld({ position: body.position, rotation: frame, scale: body.radius }, [0.3, -2.4, 1.6]),
    );
    const [outline] = lightAids(spot, body, layout);
    expect(outline?.shape === 'outline' && Array.from(outline.axes)).toEqual(Array.from(frame));
    const side: BodyLight = { ...spot, id: 'added-side', kind: 'directional', from: [-0.4, -0.6, 0.7], position: undefined };
    const way = lightAids(side, body, layout)[0];
    const l = Math.hypot(-0.4, -0.6, 0.7);
    const want = turn(frame, [-0.4 / l, -0.6 / l, 0.7 / l]);
    expect(way?.shape === 'beam' && way.from.map((v, k) => v - want[k]!).every((d) => Math.abs(d) < 1e-6)).toBe(true);
  });

  it("show a spot's cone's edges as the eye looking sees them, the cone itself where it is", () => {
    const front = spotEdges(spot, body, layout, layout.eye);
    const side = spotEdges(spot, body, layout, [70, 40, 30]);
    expect(front.length).toBe(2);
    expect(side.length).toBe(2);
    expect(side).not.toEqual(front);
    // Each edge from the spot itself, wherever it is seen from.
    const apex = lightMarkerAt(spot, body, layout)!.at;
    for (const [a] of [...front, ...side]) a.forEach((v, k) => expect(v).toBeCloseTo(apex[k]!, 6));
  });
});

describe("a body's variants as its editor stacks them", () => {
  it('puts its variants on under the level edited over its own, and names what over it wins', () => {
    const scene: BodyInfo = {
      ...korhal({}),
      below: { turn: 10, materials: { clouds: { glow: 1 } } },
      variantsBelow: [{ name: 'the Shield variant', settings: { turn: 20, materials: { clouds: { glow: 3 } } } }],
    };
    expect(valuesOf(scene).turn).toBe(20); // the variant's over its own
    expect(bodyView(scene, false, true).origins.turn).toBe('the Shield variant');
    expect(materialAt(materialsOf(scene), 'clouds')?.origins.glow).toBe('the Shield variant');
    expect(bodyView(scene, false, true).overrides).toEqual({}); // nothing over a scene's
    // Its own settings edited, a variant on over them: what the variant sets is marked overridden.
    const own: BodyInfo = {
      ...korhal({ turn: 5, materials: { clouds: { glow: 2 } } }),
      above: [{ name: 'the Shield variant', settings: { turn: 20, materials: { clouds: { glow: 3 } } } }],
    };
    expect(valuesOf(own).turn).toBe(5); // the value edited, as edited
    expect(bodyView(own, false, true).overrides.turn).toBe('the Shield variant');
    expect(materialAt(materialsOf(own), 'clouds')?.overrides?.glow).toBe('the Shield variant');
    expect(materialAt(materialsOf(own), 'clouds')?.overrides?.strength).toBeUndefined();
  });
});
