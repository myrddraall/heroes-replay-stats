import { describe, expect, it } from 'vitest';
import { forwardOf } from '../camera/camera';
import { bodyExtent, bodyFrame, partsExtent, projectionMatrix, viewMatrix, viewUp } from './space';
import type { BodyPart } from '../formats/planet-files';
import { placementFrame, placementUp } from './graph';

/** A point through a column-major matrix, divided by w: normalized device coordinates. */
function transform(m: Float32Array, [x, y, z]: [number, number, number]): [number, number, number] {
  const out = [0, 1, 2, 3].map((r) => m[r]! * x + m[4 + r]! * y + m[8 + r]! * z + m[12 + r]!);
  return [out[0]! / out[3]!, out[1]! / out[3]!, out[2]! / out[3]!];
}

describe('the camera', () => {
  // The Play screen's: behind the floor, looking along +y, tilted down a little, z up.
  const eye: [number, number, number] = [0, -41.2, 5.6];
  const forward: [number, number, number] = [0, 0.9997, -0.025];
  const view = viewMatrix(eye, forward, [0, 0, 1]);
  const projection = projectionMatrix(43, 2.4, 0.3762, 185);
  const project = (p: [number, number, number]) => transform(projection, transform(view, p));

  it('puts what it looks at in the middle of the screen', () => {
    const [x, y] = project([
      eye[0] + forward[0] * 100,
      eye[1] + forward[1] * 100,
      eye[2] + forward[2] * 100,
    ]);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it('keeps x to the right and z up', () => {
    expect(project([10, 40, 5.6 - 2])[0]).toBeGreaterThan(0);
    expect(project([0, 40, 30])[1]).toBeGreaterThan(0);
  });

  it('keeps its vertical field of view whatever the width: the edge of a 43° view is the top of the screen', () => {
    const up = Math.tan((21.5 * Math.PI) / 180);
    const top = transform(projectionMatrix(43, 0.5, 0.1, 100), [0, up * 10, -10]);
    expect(top[1]).toBeCloseTo(1);
  });
});

describe('a body\u2019s frame', () => {
  type V = readonly [number, number, number];
  const UP: V = [0, 0, 1];
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a: V): V => {
    const l = Math.hypot(...a);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const off = (v: V, y: V): V =>
    unit(sub(v, [y[0] * dot(v, y), y[1] * dot(v, y), y[2] * dot(v, y)]));
  const axis = (axes: Float32Array, k: number): V => [
    axes[3 * k]!,
    axes[3 * k + 1]!,
    axes[3 * k + 2]!,
  ];
  /** A point `ahead` along a camera's look, `right` and `up` of it in its view. */
  const inViewOf = (eye: V, forward: V, ahead: number, right: number, up: number): V => {
    const view = viewMatrix(eye, forward, UP);
    const r: V = [view[0]!, view[4]!, view[8]!];
    const u: V = [view[1]!, view[5]!, view[9]!];
    return [0, 1, 2].map(
      (k) => eye[k]! + forward[k]! * ahead + r[k]! * right + u[k]! * up,
    ) as unknown as V;
  };
  const apart = (a: Float32Array, b: Float32Array) =>
    Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

  it('turns its z to the view\u2019s up, square to the way to the body, y away from the eye, x to the right', () => {
    const eye: V = [3, -20, 7];
    for (const [turn, tilt] of [
      [0, 0],
      [25, -40],
      [-60, 75],
      [140, -88],
    ] as const) {
      const forward = forwardOf(turn, tilt);
      const up = viewUp({ forward, up: UP });
      const view = viewMatrix(eye, forward, UP);
      expect(up.map((v, k) => v - view[1 + 4 * k]!).every((d) => Math.abs(d) < 1e-6)).toBe(true);
      const position = inViewOf(eye, forward, 40, 6, -9);
      const { axes, eye: seen } = bodyFrame(position, 2, eye, up);
      const y = unit(sub(position, eye));
      const [x, fy, z] = [0, 1, 2].map((k) => axis(axes, k));
      off(up, y).forEach((v, k) => expect(z![k]).toBeCloseTo(v, 6));
      y.forEach((v, k) => expect(fy![k]).toBeCloseTo(v, 6));
      expect(dot(x!, [view[0]!, view[4]!, view[8]!])).toBeGreaterThan(0.9); // to the right
      expect(seen[1]).toBeCloseTo(-Math.hypot(...sub(position, eye)) / 2, 5);
    }
  });

  it('keeps a body in the middle of the view upright on the screen however the camera tilts', () => {
    const eye: V = [0, 0, 0];
    for (const tilt of [-89.9, -60, 0, 45, 89.9]) {
      const forward = forwardOf(30, tilt);
      const view = viewMatrix(eye, forward, UP);
      const { axes } = bodyFrame(
        inViewOf(eye, forward, 50, 0, 0),
        1,
        eye,
        viewUp({ forward, up: UP }),
      );
      [view[0]!, view[4]!, view[8]!].forEach((v, k) => expect(axes[k]).toBeCloseTo(v, 5));
      [view[1]!, view[5]!, view[9]!].forEach((v, k) => expect(axes[6 + k]).toBeCloseTo(v, 5));
    }
  });

  it('turns only a little for a little tilt, down to straight down or up: no jump', () => {
    const eye: V = [0, -40, 5];
    for (const sign of [-1, 1]) {
      // A body near what the camera looks at, straight down (or up) from the eye.
      const position: V = [4, -37, 5 + sign * 60];
      const frameAt = (tilt: number) => {
        const forward = forwardOf(0, tilt);
        return bodyFrame(position, 3, eye, viewUp({ forward, up: UP })).axes;
      };
      for (let tilt = 80; tilt < 89.99; tilt += 0.01)
        expect(apart(frameAt(sign * tilt), frameAt(sign * (tilt + 0.01)))).toBeLessThan(1e-3);
      // Looking exactly along the up: as the tilt comes to it.
      const straight = bodyFrame(position, 3, eye, viewUp({ forward: [0, 0, sign], up: UP })).axes;
      expect(apart(straight, frameAt(sign * 89.999))).toBeLessThan(1e-3);
      expect(straight.every(Number.isFinite)).toBe(true);
    }
  });

  it('is as it was for a body in the middle of the Play screen\u2019s view (the game\u2019s scene unchanged)', () => {
    const eye: V = [0, -41.2, 5.6];
    const forward: V = [0, 0.9997, -0.025];
    const position = inViewOf(eye, forward, 106, 0, 0);
    const { axes } = bodyFrame(position, 9, eye, viewUp({ forward, up: UP }));
    // The frame as it was: z the world's up made square to the way to the body.
    const y = unit(sub(position, eye));
    const z = off(UP, y);
    const x: V = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
    expect(apart(axes, new Float32Array([...x, ...y, ...z]))).toBeLessThan(1e-3);
  });

  it('faces some way, the eye at its centre', () => {
    const { axes, eye } = bodyFrame([1, 2, 3], 1, [1, 2, 3], [0, 0, 1]);
    expect([...axes, ...eye].every(Number.isFinite)).toBe(true);
  });

  describe('keeping the way up of its placement frame', () => {
    // The Play screen's camera places the body; another camera looks at it.
    const layout = { eye: [0, -41.2, 5.6] as V, forward: [0, 0.9997, -0.025] as V, up: UP };
    const position = inViewOf(layout.eye, layout.forward, 106, -30, 12);
    const placement = placementFrame(position, layout);
    const steady = placementUp(placement);

    it('is the placement frame from the scene’s own camera (the game’s look unchanged)', () => {
      const { axes } = bodyFrame(position, 1, layout.eye, viewUp(layout), steady);
      expect(apart(axes, placement)).toBeLessThan(1e-6);
    });

    it('never rolls as the camera rolls or tilts: its up the placement frame’s, square to the way to it', () => {
      const eye: V = [20, -60, 30];
      const y = unit(sub(position, eye));
      const forward = unit(sub(inViewOf(eye, y, 1, 0.1, -0.2), eye));
      const frames = [0, 35, 90, 170, 260].map((roll) => {
        // The view's up turned about the way the camera looks by `roll`.
        const up = viewUp({ forward, up: UP });
        const right = unit([
          forward[1] * up[2] - forward[2] * up[1],
          forward[2] * up[0] - forward[0] * up[2],
          forward[0] * up[1] - forward[1] * up[0],
        ]);
        const a = (roll * Math.PI) / 180;
        const rolled: V = [0, 1, 2].map(
          (k) => up[k]! * Math.cos(a) + right[k]! * Math.sin(a),
        ) as unknown as V;
        return bodyFrame(position, 2, eye, rolled, steady).axes;
      });
      off(steady, y).forEach((v, k) => expect(axis(frames[0]!, 2)[k]).toBeCloseTo(v, 6));
      for (const f of frames.slice(1)) expect(apart(f, frames[0]!)).toBeLessThan(1e-6);
    });

    it('seen down its pole takes the view’s up, eased in: no jump, and finite there', () => {
      const up: V = [0, 0, 1];
      const above: V = [0, 0, 50];
      // A camera looking nearly straight up at it, its up across the way the eye slides.
      const view = viewUp({ forward: unit([0, 0.001, 1]), up: UP });
      // The eye slid from well off the pole to right under it.
      const frameAt = (side: number) => bodyFrame(above, 1, [side, 0, 0], view, up).axes;
      for (let side = 30; side > 0.01; side -= 0.01)
        expect(apart(frameAt(side), frameAt(side - 0.01))).toBeLessThan(1e-2);
      const under = bodyFrame(above, 1, [0, 0, 0], view, up).axes;
      expect(under.every(Number.isFinite)).toBe(true);
      expect(apart(under, bodyFrame(above, 1, [0, 0, 0], view).axes)).toBeLessThan(1e-6);
      // Its up and the view's exactly against each other: some way, finite.
      const against = viewUp({ forward: unit([0.001, 0, 1]), up: UP });
      expect(bodyFrame(above, 1, [10, 0, 0], against, up).axes.every(Number.isFinite)).toBe(true);
    });
  });
});

describe('bodyExtent', () => {
  it('widens a body\u2019s square past its radius by how near it is, enough for its outline', () => {
    // A sphere of radius 3 at distance 5: its outline on the plane through its centre is 3.75 out.
    expect(bodyExtent(1.5, 2, 5)).toBeCloseTo(3.75);
    // Far away it is hardly wider than its radius.
    expect(bodyExtent(1, 1, 1000)).toBeCloseTo(1, 5);
  });

  it('stays finite with the eye inside the body', () => {
    expect(Number.isFinite(bodyExtent(10, 1, 5))).toBe(true);
  });
});

describe('partsExtent', () => {
  const ring = (seen?: number): BodyPart => ({
    role: 'ring',
    shape: { kind: 'ring', inner: 0.84, outer: 0.92, depth: -0.67, seen },
    mapping: { kind: 'ring', from: 0, uMax: 0.5 },
    materials: [],
  });
  const body: BodyPart = {
    role: 'surface',
    shape: { kind: 'sphere', radius: 1, side: 'near' },
    mapping: { kind: 'ring', from: 0, uMax: 0.5 },
    materials: [],
  };

  it('widens for a ring nearer the eye than the body’s centre, past its sphere', () => {
    // A ring 0.92 out, 0.67 nearer an eye 4.33 away: 0.92 · 4.33 / 3.66 on the square.
    expect(partsExtent(1, [body, ring()], 4.33)).toBeCloseTo((0.92 * 4.33) / 3.66, 4);
    expect(partsExtent(1, [body], 4.33)).toBeCloseTo(bodyExtent(1, 1, 4.33), 6);
  });

  it('sizes a ring modelled to be seen from one distance to lie on the limb from another', () => {
    // Seen from where it was modelled: as modelled. From further: bigger than modelled, on the limb.
    expect(partsExtent(1, [ring(4.33)], 4.33)).toBeCloseTo(partsExtent(1, [ring()], 4.33), 6);
    const far = 20;
    const limb = (d: number) => 1 / Math.sqrt(d * d - 1); // the limb's tangent from d
    const asModelled = 0.92 / (4.33 - 0.67) / limb(4.33); // the ring's edge against the limb
    expect(partsExtent(1, [ring(4.33)], far) / far / limb(far)).toBeCloseTo(asModelled, 3);
  });
  it('takes a ring fixed in the world as the sphere it turns within', () => {
    const r = ring();
    // Out to its outer edge, its plane's depth off the centre: a sphere seen from 4.33.
    const sphere = Math.hypot(0.92, 0.67);
    expect(partsExtent(1, [body, r], 4.33, new Set([r]))).toBeCloseTo(
      bodyExtent(1, sphere, 4.33),
      9,
    );
    // Only the ring given counts so; another stays flat.
    expect(partsExtent(1, [body, r], 4.33, new Set([ring()]))).toBe(
      partsExtent(1, [body, r], 4.33),
    );
  });
});

describe('placementFrame', () => {
  it("is the body's billboard frame as the scene's own camera sees it, whatever its radius", () => {
    const layout = {
      eye: [-0.0018, -41.1988, 5.6051],
      forward: [1.9e-5, 0.999687, -0.025004],
      up: [0, 0, 1],
    } as const;
    for (const radius of [1, 9.037, 27.25])
      expect(Array.from(placementFrame([37.282, 64.892, 14.189], layout))).toEqual(
        Array.from(bodyFrame([37.282, 64.892, 14.189], radius, layout.eye, viewUp(layout)).axes),
      );
  });
});
