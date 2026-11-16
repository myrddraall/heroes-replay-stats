import { describe, expect, it } from 'vitest';
import type { BodyLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import { bodyTransform, pointToWorld, type Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
import {
  aimHandle,
  draggedAcross,
  type LightDrag,
  lightDragged,
  lightDragStep,
  lightHandle,
  placedLightMarkers,
} from './light-drag';
import { placeOut, wayOut } from './markers';
import type { SceneMarker } from './scene-markers';

// A body a radius wide at 10 ahead of an eye at the origin looking along +y.
const body = { id: 'b', position: [0, 10, 0] as const, radius: 1 };
const view = { eye: [0, 0, 0], forward: [0, 1, 0], up: [0, 0, 1] } as const;
const eye: Vec3 = [0, 0, 0];
const frame = bodyTransform(body, view);
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const near = (a: readonly number[], b: readonly number[], digits = 3) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));
const light = (l: Partial<BodyLight>) =>
  ({ id: 'added-a', name: 'Light', colour: '#ffffff', strength: 1, enabled: true, ...l }) as BodyLight;

describe('dragging a light’s marker', () => {
  it('takes one from a side round its body, the side it comes from following the pointer', () => {
    // Its marker 1.8 radii out towards the eye; the pointer on that sphere, a little across.
    const way = unit([Math.sin(0.5), -Math.cos(0.5), 0.2]);
    const to: Vec3 = [way[0] * 1.8, 10 + way[1] * 1.8, way[2] * 1.8];
    const { change, at } = lightDragged(lightHandle({ from: [0, -1, 0] }, frame)!, eye, unit(to), [
      0, 8.2, 0,
    ]);
    near(at, to);
    near(wayOut(change.from!, body, view), way);
    expect(Math.hypot(...change.from!)).toBeCloseTo(1, 4);
  });

  it('takes a point or a spot across the view, as far from the eye as it was', () => {
    const was = placeOut([0, -3, 0], body, view);
    const { change, at } = lightDragged(lightHandle({ position: [0, -3, 0] }, frame)!, eye, unit([1, 7, 0.5]), was);
    near(at, [1, 7, 0.5]);
    near(placeOut(change.position!, body, view), [1, 7, 0.5]);
    // The pointer turned away from it: where it was.
    expect(draggedAcross(eye, [0, -1, 0], was)).toEqual(was);
  });

  it('aims a spot at the spot of its body under the pointer', () => {
    const handle = aimHandle({ position: [0, -3, 0] }, frame)!;
    expect(handle.free).toBeUndefined();
    const spot = unit([Math.sin(0.35), -Math.cos(0.35), 0]);
    const on: Vec3 = [spot[0], 10 + spot[1], spot[2]];
    const { change } = lightDragged(handle, eye, unit(on), [0, 9, 0]);
    expect(change.lookAt?.kind).toBe('body');
    const at = (change.lookAt as { at: Vec3 }).at;
    expect(Math.hypot(...at)).toBeCloseTo(1, 4);
    near(pointToWorld(frame, at), on);
  });

  it('aims one along a direction towards the pointer, across the view', () => {
    const handle = aimHandle({ position: [0, -3, 2], aim: [0, 1, 0] }, frame)!;
    expect(handle.free).toBe(true);
    const was: Vec3 = [0, 10, 2];
    const ray = unit([1, 10, 2]);
    const { change } = lightDragged(handle, eye, ray, was);
    const to = draggedAcross(eye, ray, was);
    const spot = placeOut([0, -3, 2], body, view);
    expect(change.lookAt?.kind).toBe('free');
    near(
      wayOut((change.lookAt as { direction: Vec3 }).direction, body, view),
      unit([to[0] - spot[0], to[1] - spot[1], to[2] - spot[2]]),
    );
  });

  it('keeps where the marker is from its start to its end, a change on each move', () => {
    const markers: SceneMarker[] = placedLightMarkers(
      { id: 'm', key: 'k', kind: 'light', label: 'Light', icon: 'wb_sunny', selected: true },
      light({ kind: 'point', position: [0, -3, 0] }),
      body,
      view,
      eye,
    );
    const dragging = { light: null as Vec3 | null };
    const drag = (phase: LightDrag['phase'], ray: Vec3) =>
      lightDragStep(markers, eye, { phase, id: 'm', key: 'k', ray }, dragging);
    expect(drag('start', unit([0, 7, 0]))).toBeNull();
    near(dragging.light!, [0, 7, 0]);
    near(drag('move', unit([1, 7, 0]))!.position!, [1, -3, 0]);
    near(dragging.light!, [1, 7, 0]);
    expect(drag('end', unit([1, 7, 0]))).toBeNull();
    expect(dragging.light).toBeNull();
  });

  it('marks how each light is dragged, a spot selected with a handle for its aim', () => {
    const base = { id: 'm', key: 'k', kind: 'light' as const, label: 'Spot', icon: 'i' };
    const spot = light({ kind: 'spot', position: [0, -3, 0] });
    const selected = placedLightMarkers({ ...base, selected: true }, spot, body, view, eye);
    expect(selected.map((m) => [m.kind, m.handle?.rule])).toEqual([
      ['light', 'across'],
      ['aim', 'aim'],
    ]);
    near(selected[1]!.at, [0, 9, 0]);
    expect(placedLightMarkers({ ...base, selected: false }, spot, body, view, eye)).toHaveLength(1);
    const side = light({ kind: 'directional', from: [0, -1, 0] });
    expect(placedLightMarkers({ ...base, selected: true }, side, body, view, eye)[0]?.handle?.rule).toBe(
      'round',
    );
    expect(placedLightMarkers({ ...base, selected: true }, light({ kind: 'ambient' }), body, view, eye)).toEqual(
      [],
    );
  });
});
