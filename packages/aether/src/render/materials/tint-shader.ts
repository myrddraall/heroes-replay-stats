import type { Node } from 'three/webgpu';
import { clamp, dot, If, int, Loop, vec3 } from 'three/tsl';
import { gradientBy, hslBy, tintBy } from './blend-shader';

/**
 * A run of tints in a shader (`tintsUniforms` sets their rows): each in turn over what the ones
 * before it left. Shared by the shaders that tint (a material's, the sky's particles').
 */

/** A colour's channel as a tint's mask reads it (`TintMaskChannel`: 0 r, 1 g, 2 b, 3 a, 4 its brightness). */
export function channelOn(v: Node<'vec4'>, channel: Node<'int'>): Node<'float'> {
  const on = v.a.toVar();
  If(channel.equal(0), () => {
    on.assign(v.r);
  })
    .ElseIf(channel.equal(1), () => {
      on.assign(v.g);
    })
    .ElseIf(channel.equal(2), () => {
      on.assign(v.b);
    })
    .ElseIf(channel.equal(4), () => {
      on.assign(dot(v.rgb, vec3(0.3, 0.59, 0.11)));
    });
  return on;
}

/**
 * `count` tints (row `r` of the i-th: `row(i, r)`) over `colours`, each only if of `stage` (0
 * after lighting, 1 before; null: whatever its stage), on where `maskOn` (given its rows 3 and 4)
 * says, inverted where its mask says, by its strength.
 */
export function tintRun(
  count: Node<'int'>,
  row: (i: Node<'int'>, r: number) => Node<'vec4'>,
  stage: number | null,
  maskOn: (d: Node<'vec4'>, e: Node<'vec4'>) => Node<'float'>,
  colours: readonly Node<'vec3'>[],
): void {
  Loop(count, ({ i }) => {
    const a = row(i, 0).toVar();
    const b = row(i, 1).toVar();
    const apply = () => {
      const d = row(i, 3).toVar();
      const on = clamp(maskOn(d, row(i, 4)), 0, 1).toVar();
      If(d.w.greaterThan(0.5), () => {
        on.assign(on.oneMinus());
      });
      const strength = a.w.mul(on).toVar();
      const kind = int(b.x).toVar();
      for (const x of colours)
        If(kind.equal(0), () => {
          x.assign(tintBy(x, a.rgb, int(b.y), strength));
        })
          .ElseIf(kind.equal(1), () => {
            x.assign(hslBy(x, row(i, 2).xyz, strength));
          })
          .Else(() => {
            x.assign(
              gradientBy(x, row(i, 5), row(i, 6), row(i, 7), row(i, 8), int(b.w), strength),
            );
          });
    };
    if (stage === null) apply();
    else If(int(b.z).equal(stage), apply);
  });
}
