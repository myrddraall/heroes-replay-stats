import { describe, expect, it } from 'vitest';
import type { DataTexture } from 'three/webgpu';
import { UniformSet } from './uniforms';
import { DrawValues } from './shader-uniforms';
import { rimTurn } from '../../space/directions';

type Vec3 = readonly [number, number, number];

/** A vector turned about an axis (unit) by an angle in radians, as the CPU's matrices must turn it. */
function turnAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = [
    axis[1] * v[2] - axis[2] * v[1],
    axis[2] * v[0] - axis[0] * v[2],
    axis[0] * v[1] - axis[1] * v[0],
  ];
  const d = (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - c);
  return [0, 1, 2].map((i) => v[i]! * c + k[i]! * s + axis[i]! * d) as unknown as Vec3;
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const right = unit([0.8, 0.1, -0.2]);
const up = unit([-0.1, 0.9, 0.3]);
const toEye: Vec3 = [0.3, -0.5, 0.81];

const expectClose = (got: readonly number[], want: readonly number[]) =>
  want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 6));

describe('DrawValues', () => {
  it("turns a layer's fresnel view about up by its lean and the rim's x, then about right by their y", () => {
    const d = new DrawValues();
    d.set('uRight', right);
    d.set('uUp', up);
    d.set('uRimTurn', [0.2, -0.3]);
    d.set('uLayers[1].fTurn', [0.5, 0.1]);
    const m = d.get('uLayers[1].view') as readonly number[];
    // (By column, as a mat3 uniform takes it.)
    const turned = [0, 1, 2].map(
      (r) => m[r]! * toEye[0] + m[3 + r]! * toEye[1] + m[6 + r]! * toEye[2],
    );
    expectClose(turned, turnAbout(turnAbout(toEye, up, 0.7), right, -0.2));
  });

  it("gives a layer's turn as its angle's cos and sin", () => {
    const d = new DrawValues();
    d.set('uLayers[3].angle', 0.6);
    expectClose(d.get('uLayers[3].spin') as readonly number[], [Math.cos(0.6), Math.sin(0.6)]);
  });

  it("turns a rim light's view by its aim, the body's rim turn added where its grid is revealed", () => {
    const d = new DrawValues();
    const set = new UniformSet();
    set.i1('uLightCount', 2);
    set.iv('uLightKind', [0, 5]);
    set.fv('uLightAim', [0, 0, 0, 0.4, -0.25, 0], '3fv');
    d.apply(set);
    d.set('uRight', right);
    d.set('uUp', up);
    d.set('uRimTurn', [0.2, -0.3]);
    const rows = () => {
      const data = (d.tableTexture as DataTexture).image.data as Float32Array;
      // (The second reach's rows 8 to 10, eleven rows of four each.)
      const at = (1 * 11 + 8) * 4;
      return [0, 1, 2].map((r) =>
        [0, 1, 2].reduce((sum, c) => sum + data[at + r * 4 + c]! * toEye[c]!, 0),
      );
    };
    expectClose(rows(), turnAbout(turnAbout(toEye, up, 0.4), right, -0.25));
    d.set('uRevealed', 1);
    expectClose(rows(), turnAbout(turnAbout(toEye, up, 0.6), right, -0.55));
    d.set('uUp', right);
    expectClose(rows(), turnAbout(turnAbout(toEye, right, 0.6), right, -0.55));
  });

  it('gives each draw its own values: one not set reads as none', () => {
    const a = new DrawValues();
    const b = new DrawValues();
    a.set('uShapeParams', [1, 2, 3]);
    expect(a.get('uShapeParams')).toEqual([1, 2, 3]);
    expect(b.get('uShapeParams')).toBeUndefined();
  });

  describe("turning a body's reaches into the frame it is shaded in", () => {
    /** A quarter turn about z: x to y, y to -x (by column). */
    const QUARTER = [0, 1, 0, -1, 0, 0, 0, 0, 1];
    const reaches = () => {
      const set = new UniformSet();
      set.i1('uLightCount', 2);
      set.iv('uLightKind', [2, 5]);
      set.fv('uLightDir', [0.6, 0, -0.8, -0.3, 0.9, 0.3], '3fv');
      set.fv('uLightPos', [1, 2, 3, 0, 0, 0], '3fv');
      set.fv('uLightWrap', [0.25, 0]);
      set.fv('uLightAim', [0, 1, 0, 0.4, -0.25, 0], '3fv');
      return set;
    };
    const table = (d: DrawValues) => (d.tableTexture as DataTexture).image.data as Float32Array;
    const row = (data: Float32Array, i: number, r: number) =>
      Array.from(data.subarray((i * 11 + r) * 4, (i * 11 + r) * 4 + 4));

    it('copies them as they are where the turn is none', () => {
      const plain = new DrawValues();
      plain.apply(reaches());
      const none = new DrawValues();
      none.apply(reaches());
      none.set('uLightTurn', [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      none.set('uLeanTurn', [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      expect(Array.from(table(none).subarray(0, 88))).toEqual(
        Array.from(table(plain).subarray(0, 88)),
      );
    });

    it("turns a light's direction, place and aim, its fourth numbers kept", () => {
      const d = new DrawValues();
      d.apply(reaches());
      d.set('uLightTurn', QUARTER);
      const data = table(d);
      expectClose(row(data, 0, 0), [0, 0.6, -0.8, 0]);
      expectClose(row(data, 0, 3), [-2, 1, 3, 0.25]);
      expectClose(row(data, 0, 4), [-1, 0, 0, 0]);
    });

    it("works a rim's aim out again from its lean turned into the view", () => {
      const d = new DrawValues();
      d.apply(reaches());
      d.set('uLightTurn', QUARTER);
      const before = row(table(d), 1, 4);
      // (Its lean, the way it comes from: its direction the other way.)
      expectClose(before, [0.4, -0.25, 0, 0]);
      d.set('uLeanTurn', QUARTER);
      const [yaw, pitch] = rimTurn([0.9, 0.3, -0.3]);
      expectClose(row(table(d), 1, 4), [-yaw, -pitch, 0, 0]);
      // Back to none: as set again.
      d.set('uLeanTurn', [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      expectClose(row(table(d), 1, 4), [0.4, -0.25, 0, 0]);
    });
  });
});
