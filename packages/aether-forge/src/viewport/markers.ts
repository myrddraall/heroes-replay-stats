import {
  alongToSphere,
  AXIS_NAMES_PAST,
  axisEnds,
  type AxisLine,
  coneEdges,
  type LightAid,
  ringFacing,
  type LightOutline,
} from '@myrddraall/heroes-replay-stats-aether/aids';
import type { SetPlanet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import { without } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { poleOf } from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  type BodyLight,
  type LightKind,
  placedLight,
  rgbOf,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { LIGHT_KINDS } from '@myrddraall/heroes-replay-stats-aether/render';
import {
  aimOf,
  bodyFrame,
  bodyTransform,
  type LookAt,
  NO_QUAT,
  type Orientation,
  placementFrame,
  pointToLocal,
  pointToWorld,
  poseKept,
  turn,
  type Vec3,
  type Viewpoint,
  viewUp,
} from '@myrddraall/heroes-replay-stats-aether/space';
import type { SceneMarker } from './scene-markers';
import { type BodyInfo, valuesOf } from '../bodies/body';
import { materialsOf } from '../materials/materials';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';

/** The markers an editor draws over the view (lights, axes, poles) and what dragging them changes. */

/**
 * The way a light comes from (`from`, in its body's frame as `layout` sees it), out of the body,
 * in the scene: a unit vector. `layout` is the view the body's lights are placed from
 * (`lightsView`): the scene's own camera for a body fixed in the world (the light fixed there,
 * whatever camera the editor looks through), the editor's for one facing the camera.
 */
export function wayOut(from: Vec3, body: SetPlanet, layout: Viewpoint): Vec3 {
  const way = turn(bodyTransform(body, layout).rotation, from);
  const length = Math.hypot(...way) || 1;
  return way.map((v) => v / length) as unknown as Vec3;
}

/** A place near a body (in its placement frame, in its radii: see `wayOut`), in the scene. */
export function placeOut(at: Vec3, body: SetPlanet, layout: Viewpoint): Vec3 {
  return pointToWorld(bodyTransform(body, layout), at);
}

/**
 * A light's marker about its body: one from all round on the body's middle; one from a side out
 * from the body on that side, a line to it from the surface; one from a point where it is, a
 * line to the nearest of the surface (the middle of what it lights); a spot where it is, a line
 * along its aim to where it meets the body (the middle of its light circle; past the body, to
 * its nearest point). `at` and, where a line is drawn, where it starts.
 */
export function lightMarkerAt(
  light: {
    readonly kind?: LightKind;
    readonly from?: Vec3;
    readonly position?: Vec3;
    readonly lookAt?: LookAt;
    readonly aim?: Vec3;
  },
  body: SetPlanet,
  layout: Viewpoint,
): { readonly at: Vec3; readonly from?: Vec3 } | null {
  const along = (way: Vec3, radii: number) =>
    body.position.map((v, k) => v + way[k]! * body.radius * radii) as unknown as Vec3;
  if (light.position) {
    const at = placeOut(light.position, body, layout);
    if (light.kind === 'spot') {
      const p = light.position;
      const aim = aimOf(p, light.lookAt, light.aim);
      const t = alongToSphere(p, aim);
      return {
        at,
        from: placeOut([p[0] + aim[0] * t, p[1] + aim[1] * t, p[2] + aim[2] * t], body, layout),
      };
    }
    const way = wayOut(light.position, body, layout);
    return { at, from: along(way, 1.05) };
  }
  if (light.from) {
    const way = wayOut(light.from, body, layout);
    return { at: along(way, 1.8), from: along(way, 1.05) };
  }
  return null;
}

/**
 * The edges of a spot light's cone as seen from `eye` (the camera the editor looks through), from
 * the spot to the body (none for any other light, or with the eye inside the cone), in the scene:
 * drawn with its marker when it is selected. The cone is where the renderer puts it, in the body's
 * placement frame (`layout`: see `wayOut`).
 */
export function spotEdges(
  light: BodyLight,
  body: SetPlanet,
  layout: Viewpoint,
  eye: Vec3,
): readonly (readonly [Vec3, Vec3])[] {
  const placed = placedLight(light);
  if (placed?.kind !== 'spot' || !placed.position || !placed.aim) return [];
  const frame = bodyTransform(body, layout);
  return coneEdges(placed.position, placed.aim, placed.cone ?? 90, pointToLocal(frame, eye)).map(
    ([a, b]) => [pointToWorld(frame, a), pointToWorld(frame, b)] as const,
  );
}

/**
 * The lines of a light's settings, fainter than its own, drawn with its marker when it is
 * selected (in the scene, placed as `spotEdges` places a spot's): a spot's cone where it starts to
 * fade (its Edge in from its edge, where it has one); how far a point or a spot reaches (where it
 * is half as strong), a ring about it facing the eye.
 */
export function lightSettingLines(
  light: BodyLight,
  body: SetPlanet,
  layout: Viewpoint,
  eye: Vec3,
): readonly (readonly [Vec3, Vec3])[] {
  const placed = placedLight(light);
  if (!placed?.position || (placed.kind !== 'point' && placed.kind !== 'spot')) return [];
  const frame = bodyTransform(body, layout);
  const local = pointToLocal(frame, eye);
  const inner =
    placed.kind === 'spot' && placed.aim && (placed.edge ?? 0) > 0
      ? coneEdges(placed.position, placed.aim, (placed.cone ?? 90) * (1 - placed.edge!), local)
      : [];
  const ring = ringFacing(placed.position, placed.fade ?? 1, local);
  return [...inner, ...ring].map(
    ([a, b]) => [pointToWorld(frame, a), pointToWorld(frame, b)] as const,
  );
}

/**
 * What the view shows of a light selected, about a body it lights (placed in the body's placement
 * frame, `layout`: see `wayOut`): the outline of where it falls on the body's sphere (any light but
 * one from all round), and a directional light's beam out of the body the way it comes from. None
 * of a light switched off.
 */
export function lightAids(light: BodyLight, body: SetPlanet, layout: Viewpoint): LightAid[] {
  if (!light.enabled) return [];
  const placed = placedLight(light);
  if (!placed) return [];
  const colour = rgbOf(light.colour, 1);
  const axes = Float32Array.from(bodyTransform(body, layout).rotation);
  const outline: LightOutline = {
    shape: 'outline',
    centre: body.position,
    radius: body.radius,
    axes,
    kind: placed.kind ? LIGHT_KINDS[placed.kind] : 0,
    direction: placed.direction,
    position: placed.position ?? [0, 0, 0],
    aim: placed.aim ?? [0, 0, 1],
    fade: placed.fade ?? 1,
    cone: placed.cone ?? 90,
    edge: placed.edge ?? 0,
    wrap: placed.wrap ?? 0,
    softness: placed.softness ?? 1,
    colour,
    darkens: light.darkens,
  };
  const from = placed.kind ? null : lightWay(light, body, layout);
  return from
    ? [
        {
          shape: 'beam',
          centre: body.position,
          radius: body.radius,
          from,
          colour,
          darkens: light.darkens,
        },
        outline,
      ]
    : [outline];
}

/** The way a light comes from, out of its body (see `wayOut`): a side's, or a point's or spot's place. */
export function lightWay(
  light: { readonly from?: Vec3; readonly position?: Vec3 },
  body: SetPlanet,
  layout: Viewpoint,
): Vec3 | null {
  const way = light.position ?? light.from;
  return way ? wayOut(way, body, layout) : null;
}

/** How a planet's axis shows (see `axisAids`): how far out from its middle both ways (its radii), how thick (pixels), its halves' colours. */
const AXIS_LINE = {
  reach: 1.4,
  pixels: 2.5,
  north: [1, 0.1, 0.05] as Vec3,
  south: [0.15, 0.45, 1] as Vec3,
  strength: 1,
};

/**
 * What the view shows of a planet selected: its axis, a line through its poles as far past each
 * (its north one where its Axis points). One for each frame its surfaces are drawn in (as the
 * renderer draws them, `surfaceFrame`): fixed in the world (its placement frame, from the scene's
 * own camera, `layout`), or facing the camera the editor looks through (`view`). A halo left
 * square to the camera has none.
 */
export function axisAids(
  b: BodyInfo,
  body: SetPlanet,
  layout: Viewpoint,
  view: Viewpoint,
): AxisLine[] {
  const { axis } = valuesOf(b);
  const l = Math.hypot(...axis) || 1;
  const north: Vec3 = [axis[0] / l, axis[1] / l, axis[2] / l];
  const ways = new Set(
    materialsOf(b)
      .filter((m) => m.turned)
      .map((m) => m.values.orientation),
  );
  return [...ways].map((orientation) => ({
    shape: 'axis',
    centre: body.position,
    radius: body.radius,
    // (Its Turn turns about it: where it points is the same turned or not.)
    way: turn(axisFrame(orientation, body, layout, view), north),
    ...AXIS_LINE,
    orientation,
  }));
}

/**
 * A body's Axis (in `frame`, the frame its axis is in: `axisFrame`) with its north pole (or its
 * south, `north` false) dragged to under a ray (see `axisDraggedTo`), and where the pole is now.
 */
export function poleDragged(
  line: AxisLine,
  north: boolean,
  eye: Vec3,
  ray: Vec3,
  previous: Vec3,
  frame: ArrayLike<number>,
): { readonly axis: Vec3; readonly at: Vec3 } {
  const at = axisDraggedTo(line, eye, ray, previous);
  const way = at.map((v, k) => (v - line.centre[k]!) * (north ? 1 : -1));
  const l = Math.hypot(...way) || 1;
  const world: Vec3 = [way[0]! / l, way[1]! / l, way[2]! / l];
  // Into its frame (its axes' transpose), kept to a few places as settings are.
  const axis = [0, 3, 6].map(
    (c) =>
      Math.round(
        (frame[c]! * world[0] + frame[c + 1]! * world[1] + frame[c + 2]! * world[2]) * 1e5,
      ) / 1e5,
  ) as unknown as Vec3;
  return { axis, at };
}

/** Where a pole of an axis is, as its name is put (see `poleMarkers`). */
export const poleAt = (line: AxisLine, north: boolean): Vec3 => {
  const ends = axisEnds(line, AXIS_NAMES_PAST);
  return north ? ends.north : ends.south;
};

/** The frame a body's Axis is in for its surfaces turned so (see `axisAids`). */
export const axisFrame = (
  orientation: Orientation,
  body: SetPlanet,
  layout: Viewpoint,
  view: Viewpoint,
) => (orientation === 'world' ? placementFrame(body.position, layout) : facingFrame(body, view));

/**
 * Where a pole of an axis dragged in the view goes: the point of a sphere about the body's middle
 * through where the pole was (`previous`) under the pointer, its ray from `eye` the way `ray`
 * goes. Of the two points the ray meets, the near one, or the far one where the pole was taken
 * round behind; past the sphere's outline, round over its edge and on behind it the further the
 * pointer goes (a quarter turn at most), so a pole can be taken round to the far side and back.
 */
export function axisDraggedTo(line: AxisLine, eye: Vec3, ray: Vec3, previous: Vec3): Vec3 {
  const c = line.centre;
  const to = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const o = to(eye);
  const r = Math.hypot(...to(previous));
  const b = dot(ray, o);
  const disc = b * b - (dot(o, o) - r * r);
  const at = (t: number): Vec3 => [eye[0] + ray[0] * t, eye[1] + ray[1] * t, eye[2] + ray[2] * t];
  if (disc >= 0) {
    // On the near side, unless it was taken round behind (past the outline, then back in).
    const behind = dot(to(previous), o) / Math.hypot(...o) < -0.15 * r;
    return at(-b + (behind ? 1 : -1) * Math.sqrt(disc));
  }
  // Past the outline: on its edge, then round behind it.
  const q = to(at(-b));
  const ql = Math.hypot(...q);
  const n: Vec3 = [q[0] / ql, q[1] / ql, q[2] / ql];
  const ol = Math.hypot(...o);
  const e: Vec3 = [o[0] / ol, o[1] / ol, o[2] / ol];
  const en = dot(e, n);
  const away = [-(e[0] - en * n[0]), -(e[1] - en * n[1]), -(e[2] - en * n[2])];
  const al = Math.hypot(...away) || 1;
  const beyond = Math.min(Math.PI / 2, ((ql - r) / r) * (Math.PI / 2));
  return [0, 1, 2].map(
    (k) => c[k]! + r * (Math.cos(beyond) * n[k]! + Math.sin(beyond) * (away[k]! / al)),
  ) as unknown as Vec3;
}

/** An axis's poles' names (N, S) as markers, a little past its ends; `key` the row they are of (its body's), `n` which of its axes. */
export function poleMarkers(line: AxisLine, key: string, n = 0): SceneMarker[] {
  const { north, south } = axisEnds(line, AXIS_NAMES_PAST);
  return (
    [
      ['N', north],
      ['S', south],
    ] as const
  ).map(([name, at]) => ({
    id: `${key}@pole-${name}-${n}`,
    key,
    kind: 'pole',
    label: name,
    icon: '',
    at,
    selected: true,
    pole: { north: name === 'N', axis: n },
  }));
}

/**
 * A body's settings at the level edited after a change there (`next`, the change touching
 * `touched`), its base turn changed with its Axis where the change sets or resets the Axis but not
 * the base turn itself (the Orientation section's reset clears all three, back as the data has
 * it): so the body stays as it is, and only what its Turn turns about moves (`poseKept`). A Turn
 * changed or reset turns it from its base turn (reset: back to it).
 */
export function keepingPose(
  b: BodyInfo,
  next: BodySettings,
  touched: readonly (keyof BodySettings)[],
): BodySettings {
  if (!touched.includes('axis') || touched.includes('baseTurn')) return next;
  const before = valuesOf(b);
  const after = valuesOf({ ...b, settings: next });
  const baseTurn = poseKept(
    poleOf(b.file?.parts ?? []),
    { axis: before.axis, turn: before.turn, base: before.baseTurn },
    { axis: after.axis, turn: after.turn },
  );
  const rest = without(next, ['baseTurn']) ?? {};
  if (baseTurn) return { ...rest, baseTurn };
  // None: none set here, unless a level under this one sets one (then none, said here).
  const [x, y, z] = valuesOf({ ...b, settings: rest }).baseTurn;
  return x || y || z ? { ...rest, baseTurn: NO_QUAT } : rest;
}

/** A body's frame facing the eye of `view` (its billboards' and their lights'). */
const facingFrame = (body: SetPlanet, view: Viewpoint) =>
  bodyFrame(body.position, body.radius, view.eye, viewUp(view)).axes;
