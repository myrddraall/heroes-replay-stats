import type { Node, Texture } from 'three/webgpu';
import {
  clamp,
  floor,
  Fn,
  If,
  int,
  Loop,
  max,
  min,
  mix,
  pow,
  texture,
  vec2,
  vec3,
} from 'three/tsl';
import { gradientBy, hslBy, tintBy } from '../materials/blend-shader';
import type { ShaderUniforms } from '../uniforms/shader-uniforms';
import { MAX_GRADES } from '../../tints/grading';

/**
 * A scene's colour grading in a shader: its tints on the light, graded in the tone pass before
 * tone mapping; and those on the picture, baked into a lookup table (`LUT_SIZE` on a side, its blue
 * slices side by side) the tone pass reads after.
 */

type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;
type F = Node<'float'>;

/** How many values a side of the grading's lookup table has (red, green and blue each). */
export const LUT_SIZE = 32;

/** Mid grey, which contrast turns about. */
const MID_GREY = 0.18;

/**
 * `levelsBy(c, levelsIn, levelsOut, strength)`: levels over a colour by `strength` (`levelsIn`: x
 * its input's low, y its high, z its gamma; `levelsOut`: x its output's low, y its high). (Not
 * `input`/`output`, which GLSL keeps, nor `from`/`to`, which WGSL keeps.)
 */
export const levelsBy = Fn(([c, levelsIn, levelsOut, strength]: [V3, V4, V4, F]) => {
  const t = clamp(c.sub(levelsIn.x).div(max(levelsIn.y.sub(levelsIn.x), 1e-4)), 0, 1).toVar();
  const shaped = pow(t, vec3(max(levelsIn.z, 0.01).reciprocal()));
  return mix(c, mix(vec3(levelsOut.x), vec3(levelsOut.y), shaped), strength);
}).setLayout({
  name: 'levelsBy',
  type: 'vec3',
  inputs: [
    { name: 'c', type: 'vec3' },
    { name: 'levelsIn', type: 'vec4' },
    { name: 'levelsOut', type: 'vec4' },
    { name: 'strength', type: 'float' },
  ],
});

/**
 * The grading on the light over `c` (HDR): set 0, the grading shown, or 1, the one it fades from
 * (`gradesUniforms`). White balance multiplies; brightness scales and contrast turns about mid grey;
 * lift/gamma/gain is ASC CDL's power, slope and offset; each by its strength.
 */
export function gradedLight(u: ShaderUniforms, set: 0 | 1, hdr: V3): V3 {
  const c = hdr.toVar();
  Loop(u.int(`uGradeCount${set}`), ({ i }) => {
    const at = i.add(set * MAX_GRADES);
    const a = u.row('grades', at, 0).toVar();
    const b = u.row('grades', at, 1).toVar();
    const kind = int(a.x).toVar();
    const graded = c.mul(b.rgb).toVar();
    If(kind.equal(1), () => {
      graded.assign(
        pow(max(c.mul(b.x).div(MID_GREY), vec3(0)), vec3(b.y)).mul(MID_GREY),
      );
    }).ElseIf(kind.equal(2), () => {
      const power = u.row('grades', at, 2).rgb;
      const slope = u.row('grades', at, 3).rgb;
      graded.assign(max(pow(max(c, vec3(0)), power).mul(slope).add(b.rgb), vec3(0)));
    });
    c.assign(mix(c, graded, a.y));
  });
  return c;
}

/**
 * The grading on the picture over `c` (0 to 1), as the tint pack (`tintsUniforms`, `uTint`) has it:
 * colour fills, hue/saturation, gradient maps and levels, in order.
 */
export function gradedPicture(u: ShaderUniforms, picture: V3): V3 {
  const c = picture.toVar();
  const row = (i: Node<'int'>, r: number) => u.row('tints', i, r);
  Loop(u.int('uTintCount'), ({ i }) => {
    const a = row(i, 0).toVar();
    const b = row(i, 1).toVar();
    const kind = int(b.x).toVar();
    If(kind.equal(0), () => {
      c.assign(tintBy(c, a.rgb, int(b.y), a.w));
    })
      .ElseIf(kind.equal(1), () => {
        c.assign(hslBy(c, row(i, 2).xyz, a.w));
      })
      .ElseIf(kind.equal(2), () => {
        c.assign(gradientBy(c, row(i, 5), row(i, 6), row(i, 7), row(i, 8), int(b.w), a.w));
      })
      .Else(() => {
        c.assign(levelsBy(c, row(i, 5), row(i, 6), a.w));
      });
  });
  return c;
}

/**
 * The colour a lookup table's texel stands for, at `at` (its uv: its blue slices side by side, red
 * across each, green up).
 */
export function lutColour(at: Node<'vec2'>): V3 {
  const n = LUT_SIZE;
  const x = floor(at.x.mul(n * n));
  const slice = floor(x.div(n));
  return vec3(x.sub(slice.mul(n)), floor(at.y.mul(n)), slice).div(n - 1);
}

/** A colour (0 to 1) looked up in a lookup table (`lutColour`'s layout): its texels' colours blended between. */
export function lookedUp(c: V3, lut: Texture): V3 {
  const n = LUT_SIZE;
  const x = clamp(c, 0, 1).mul(n - 1).toVar();
  const b0 = floor(x.b).toVar();
  const b1 = min(b0.add(1), n - 1);
  const at = (slice: F) =>
    vec2(slice.mul(n).add(x.r).add(0.5).div(n * n), x.g.add(0.5).div(n));
  return mix(texture(lut, at(b0)).rgb, texture(lut, at(b1)).rgb, x.b.sub(b0));
}
