import type { SceneCamera } from './play-scene';
import type { BodyShade, PartRole, PlanetIndex } from './scene-planets';

/** A planet in a set: which, where (the scene's units), and its body's radius there. */
export interface SetPlanet {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
  /** A style it wears, by id (the index's), if any. */
  readonly style?: string;
  /** Its glow: 0 none, 1 its own light's bloom as the data has it, past 1 its emissive light boosted. */
  readonly glow?: number;
  /** A glow for the parts of a role on its own (a style's shield), over `glow`. */
  readonly glows?: Partial<Record<PartRole, number>>;
  /** How far a role's parts show away from the limb, 0 to 1 (a floor under their fresnel). */
  readonly spreads?: Partial<Record<PartRole, number>>;
  /** How large a role's parts' emissive pattern is: its tiling times this. */
  readonly scales?: Partial<Record<PartRole, number>>;
  /** How much of a role's parts' emissive pattern is cut to black, 0 to 1. */
  readonly cuts?: Partial<Record<PartRole, number>>;
  /** How strongly its parts of a role show, 0 to 1 (1, as the data has them): its haze layers, its shell, its ring. */
  readonly strengths?: Partial<Record<PartRole, number>>;
  /** How strongly its light lights it, times this (1, as the data has it). */
  readonly lighting?: number;
  /** A shade from a side, over its style's (what is given here; the rest the style's or DEFAULT_SHADE). */
  readonly shade?: Partial<BodyShade>;
}

/** A set of planets to put up, largest first: each takes the tint channel of its place. */
export type PlanetSet = readonly SetPlanet[];

/** Where a set's planets may go, a region per place (large, medium, small), about the game's own. */
interface Place {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly z: readonly [number, number];
  readonly radius: readonly [number, number];
}

/**
 * The regions, in the scene's units: the game's camera is at y -41 looking along +y, so these are
 * across the view (x), at the sky's depth (y) and up it (z: the view's own extent at that depth,
 * past which a planet may hang by PAST_EDGE of its radius, so it is partly off the top or the
 * bottom at times, as the game's own large one is off the left, never wholly), each at about the
 * size of the game's own planet of that place; x is a distance from the middle, to one side or the
 * other.
 */
const PLACES: readonly Place[] = [
  { x: [18, 62], y: [55, 75], z: [-34, 40], radius: [16, 30] },
  { x: [18, 56], y: [55, 72], z: [-34, 40], radius: [6, 12] },
  { x: [12, 50], y: [48, 62], z: [-34, 40], radius: [1.3, 3.5] },
];
const PAST_EDGE = 0.7;
/** A planet on its own keeps within the view unless it is big: its radius over this is how much of PAST_EDGE it may use. */
const BIG = 30;
/** The view's half-width at a depth, as a 16:9 window shows it: for keeping a lone planet within it. */
const halfWidth = (y: number) => (y - EYE[1]) * Math.tan((43 * Math.PI) / 360) * (16 / 9);
/** How many planets a set has, by how likely: three as the game has, often; fewer, sometimes. */
const COUNTS: readonly [number, number][] = [
  [3, 0.5],
  [2, 0.35],
  [1, 0.15],
];
/** The Play screen's own templates fit only some places: its small one is a sphere, the others hemispheres. */
const ONLY_PLACES: Readonly<Record<string, readonly number[]>> = {
  'play-large': [0],
  'play-medium': [0, 1],
  'play-small': [1, 2],
};
/** The eye, for keeping planets apart on screen: the game's camera. */
const EYE: readonly [number, number, number] = [0, -41.2, 5.6];
const TRIES = 40;

/** The game's own set. */
export function playSet(index: PlanetIndex): PlanetSet {
  return index.play.map((p) => ({ id: p.id, position: p.position, radius: p.radius }));
}

/** A random number generator from a seed (mulberry32): the same seed, the same numbers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether two planets, seen from the eye, keep clear of each other. */
function apart(a: SetPlanet, b: SetPlanet): boolean {
  const angle = (p: SetPlanet) => {
    const d = Math.hypot(p.position[0] - EYE[0], p.position[1] - EYE[1], p.position[2] - EYE[2]);
    return Math.asin(Math.min(1, p.radius / d));
  };
  const dir = (p: SetPlanet): [number, number, number] => {
    const v: [number, number, number] = [
      p.position[0] - EYE[0],
      p.position[1] - EYE[1],
      p.position[2] - EYE[2],
    ];
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const [u, v] = [dir(a), dir(b)];
  const between = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])));
  return between > (angle(a) + angle(b)) * 1.15;
}

/**
 * A set drawn at random: how many planets, which (no planet twice; the game's own templates only
 * where they fit), and where in each one's place, kept apart on screen, the medium and small ones
 * on the other side from the large one, as the game's are. A planet on its own stays within the
 * view, unless it is big enough to be worth cutting off.
 */
export function randomSet(index: PlanetIndex, random: () => number): PlanetSet {
  const pick = random();
  let count = COUNTS[COUNTS.length - 1]![0];
  for (let sum = 0, i = 0; i < COUNTS.length; i++) {
    sum += COUNTS[i]![1];
    if (pick < sum) {
      count = COUNTS[i]![0];
      break;
    }
  }
  const between = ([lo, hi]: readonly [number, number]) => lo + (hi - lo) * random();
  const pool = index.planets.map((p) => p.id);
  const set: SetPlanet[] = [];
  const side = random() < 0.5 ? -1 : 1; // the large one's side; the others take the other
  for (let place = 0; place < count && pool.length; place++) {
    const fits = pool.filter((id) => (ONLY_PLACES[id] ?? [0, 1, 2]).includes(place));
    if (!fits.length) break;
    const id = fits[Math.floor(random() * fits.length)]!;
    pool.splice(pool.indexOf(id), 1);
    const region = PLACES[place]!;
    let planet: SetPlanet | undefined;
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const radius = Math.round(between(region.radius) * 100) / 100;
      const past = radius * PAST_EDGE * (count === 1 ? Math.min(1, radius / BIG) : 1);
      const y = between(region.y);
      let x = between(region.x);
      if (count === 1) x = Math.min(x, halfWidth(y) - radius + past);
      x *= place === 0 ? side : -side;
      const candidate: SetPlanet = {
        id,
        position: [
          Math.round(x * 100) / 100,
          Math.round(y * 100) / 100,
          Math.round(between([region.z[0] + radius - past, region.z[1] - radius + past]) * 100) / 100,
        ],
        radius,
      };
      if (set.every((other) => apart(other, candidate))) {
        planet = candidate;
        break;
      }
    }
    if (!planet) break; // no room left: a smaller set
    set.push(planet);
  }
  return set;
}

/**
 * Where a planet of `radius` at `position` is just beyond the edge of the view on a side (-1
 * left, 1 right): its x there. By angles about the camera, as a sphere shows: past the view's
 * half-angle (the camera's field of view, the canvas's shape), plus `turn` (radians the camera
 * may turn that way), plus the planet's own angular radius times `clearance`.
 */
export function beyondEdge(
  position: readonly [number, number, number],
  radius: number,
  camera: SceneCamera,
  aspect: number,
  side: number,
  turn: number,
  clearance: number,
): number {
  const depth = Math.max(1, position[1] - camera.eye[1]);
  const halfView = Math.atan(Math.tan((camera.fovY * Math.PI) / 360) * aspect) + turn;
  let x = 0;
  for (let i = 0; i < 3; i++) {
    // The planet's angular radius depends on its distance, which depends on where it ends up.
    const distance = Math.hypot(depth, x);
    const angular = Math.asin(Math.min(1, radius / distance));
    x = depth * Math.tan(Math.min(Math.PI / 2 - 0.01, halfView + angular * clearance));
  }
  return side * x;
}
