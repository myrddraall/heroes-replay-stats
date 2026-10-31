import type { BodyLight, LightSettings } from '@myrddraall/heroes-replay-stats-aether/lights';
import type { SetPlanet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import {
  bodyTransform,
  type LookAt,
  pointToLocal,
  pointToWorld,
  type Vec3,
  type Viewpoint,
} from '@myrddraall/heroes-replay-stats-aether/space';
import { draggedRound, lightMarkerAt, lightSettingLines, spotEdges } from './markers';
import type { SceneMarker } from './scene-markers';

/** The frame a body's lights are placed in (see `wayOut`): its middle, its axes, its radius. */
export type LightFrame = ReturnType<typeof bodyTransform>;

/**
 * How a light's marker moves when dragged in the view: one from a side (a directional, a rim, a
 * hemisphere) round its body, the side it comes from following; a point or a spot across the
 * view where it is (as far from the eye); a spot's aim (its second handle) over its body's face,
 * or, aimed along a direction (`free`), across the view as far as where it meets the body.
 */
export interface LightHandle {
  readonly rule: 'round' | 'across' | 'aim';
  readonly frame: LightFrame;
  /** A spot's place (its aim is from there), in its body's frame. */
  readonly position?: Vec3;
  readonly free?: boolean;
}

/** A light's marker dragged in the view: begun, moved (the way from the eye through the pointer), ended. */
export interface LightDrag {
  readonly phase: 'start' | 'move' | 'end';
  /** The marker's own (`SceneMarker.id`), and the light's row it selects (its `key`). */
  readonly id: string;
  readonly key: string;
  /** The way from the camera's eye through the pointer, in the scene (unit). */
  readonly ray: Vec3;
}

/**
 * How a light's marker is dragged (see `LightHandle`): one from a side by the side it comes from,
 * a point or a spot by its place; none for one with neither (from all round).
 */
export function lightHandle(
  light: { readonly from?: Vec3; readonly position?: Vec3 },
  frame: LightFrame,
): LightHandle | undefined {
  if (light.position) return { rule: 'across', frame };
  return light.from ? { rule: 'round', frame } : undefined;
}

/** A spot's aim's handle (see `LightHandle`): over its body from where it is. */
export function aimHandle(
  light: { readonly position?: Vec3; readonly lookAt?: LookAt; readonly aim?: Vec3 },
  frame: LightFrame,
): LightHandle | undefined {
  if (!light.position) return undefined;
  const free = light.lookAt ? light.lookAt.kind === 'free' : !!light.aim;
  return { rule: 'aim', frame, position: light.position, ...(free ? { free } : {}) };
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
/** Kept to a few places, as settings are (a way to 5, a place in radii to 4). */
const kept = (v: Vec3, places: number): Vec3 =>
  v.map((x) => Math.round(x * 10 ** places) / 10 ** places || 0) as unknown as Vec3;
/** A way in the scene as a body's frame has it (unit). */
const wayIn = (frame: LightFrame, way: Vec3): Vec3 =>
  unit(pointToLocal(frame, frame.position.map((v, k) => v + way[k]!) as unknown as Vec3));

/**
 * Where something dragged across the view goes: the point under the pointer as far from the eye
 * as it was (on the plane through it square to the way to it); where the pointer points away from
 * that plane, where it was.
 */
export function draggedAcross(eye: Vec3, ray: Vec3, previous: Vec3): Vec3 {
  const d: Vec3 = [previous[0] - eye[0], previous[1] - eye[1], previous[2] - eye[2]];
  const n = unit(d);
  const along = ray[0] * n[0] + ray[1] * n[1] + ray[2] * n[2];
  if (along < 1e-3) return previous;
  const t = (d[0] * n[0] + d[1] * n[1] + d[2] * n[2]) / along;
  return [eye[0] + ray[0] * t, eye[1] + ray[1] * t, eye[2] + ray[2] * t];
}

/**
 * A light's marker dragged from where it was (`previous`) to under the pointer (its ray from
 * `eye`): the light's setting changed (see `LightHandle`), and where the marker is now.
 */
export function lightDragged(
  h: LightHandle,
  eye: Vec3,
  ray: Vec3,
  previous: Vec3,
): { readonly change: Partial<LightSettings>; readonly at: Vec3 } {
  const c = h.frame.position;
  const from = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  if (h.rule === 'round') {
    const at = draggedRound(c, Math.hypot(...from(previous)), eye, ray, previous);
    return { change: { from: kept(wayIn(h.frame, from(at)), 5) }, at };
  }
  if (h.rule === 'across') {
    const at = draggedAcross(eye, ray, previous);
    return { change: { position: kept(pointToLocal(h.frame, at), 4) }, at };
  }
  if (h.free) {
    const at = draggedAcross(eye, ray, previous);
    const spot = pointToWorld(h.frame, h.position ?? [0, 0, 0]);
    const direction = wayIn(h.frame, [at[0] - spot[0], at[1] - spot[1], at[2] - spot[2]]);
    return { change: { lookAt: { kind: 'free', direction: kept(direction, 5) } }, at };
  }
  const at = draggedRound(c, h.frame.scale, eye, ray, previous);
  return { change: { lookAt: { kind: 'body', at: kept(unit(pointToLocal(h.frame, at)), 5) } }, at };
}

/**
 * A step of a light's marker's drag, for an editor: on its start, where the marker is (kept in
 * `dragging`); on each move, the light's setting changed (see `lightDragged`), where it is now
 * kept; none at its end, nor for a marker gone or not dragged.
 */
export function lightDragStep(
  markers: readonly SceneMarker[],
  eye: Vec3,
  drag: LightDrag,
  dragging: { light: Vec3 | null },
): Partial<LightSettings> | null {
  const m = markers.find((x) => x.id === drag.id);
  if (!m?.handle || drag.phase === 'end') {
    dragging.light = null;
    return null;
  }
  if (drag.phase === 'start' || !dragging.light) {
    dragging.light = m.at;
    return null;
  }
  const { change, at } = lightDragged(m.handle, eye, drag.ray, dragging.light);
  dragging.light = at;
  return change;
}

/**
 * A light's markers about a body it lights (`marker` its own but where it is), placed as
 * `lightMarkerAt` places it in the body's frame as `layout` sees it: its own, with its lines and
 * how it is dragged; a spot selected, its aim's handle too, where its aim meets the body. None for
 * one from all round (marked on the body's middle).
 */
export function placedLightMarkers(
  marker: Omit<SceneMarker, 'at'>,
  light: BodyLight,
  body: SetPlanet,
  layout: Viewpoint,
  eye: Vec3,
): SceneMarker[] {
  const at = lightMarkerAt(light, body, layout);
  if (!at) return [];
  const frame = bodyTransform(body, layout);
  const handle = lightHandle(light, frame);
  const settings = lightSettingLines(light, body, layout, eye);
  const own: SceneMarker = {
    ...marker,
    at: at.at,
    from: at.from,
    lines: [...spotEdges(light, body, layout, eye), ...settings.solid],
    thinLines: settings.thin,
    softLines: settings.soft,
    ...(handle ? { handle } : {}),
  };
  const aim = light.kind === 'spot' && marker.selected ? aimHandle(light, frame) : undefined;
  if (!aim || !at.from) return [own];
  return [
    own,
    {
      id: `${marker.id}@aim`,
      key: marker.key,
      kind: 'aim',
      label: `${marker.label} aim`,
      icon: 'adjust',
      at: at.from,
      selected: true,
      handle: aim,
    },
  ];
}
