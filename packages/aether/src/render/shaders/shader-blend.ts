import type { Node } from 'three/webgpu';
import { abs, clamp, dot, Fn, If, max, min, mix, select, sqrt, step, vec3 } from 'three/tsl';

/**
 * The blend modes in three.js's shading language, as `BLEND_MODES` numbers them (`blend(b, s,
 * mode)`: backdrop b blended with source s, both 0 to 1; CSS's as Compositing and Blending Level 1
 * defines them, the others as Photoshop does), and a tint blended over a colour by its strength (a
 * colour past white, HDR light, blended at its hue, keeping its brightness). Declared shader
 * functions, each written out once in a shader however often it is called.
 */

type V3 = Node<'vec3'>;
type F = Node<'float'>;

const lum = Fn(([c]: [V3]) => dot(c, vec3(0.3, 0.59, 0.11))).setLayout({
  name: 'blendLum',
  type: 'float',
  inputs: [{ name: 'c', type: 'vec3' }],
});

const clipColour = Fn(([c0]: [V3]) => {
  const c = c0.toVar();
  const l = lum(c).toVar();
  const n = min(min(c.r, c.g), c.b).toVar();
  const x = max(max(c.r, c.g), c.b).toVar();
  If(n.lessThan(0), () => {
    c.assign(c.sub(l).mul(l).div(l.sub(n)).add(l));
  });
  If(x.greaterThan(1), () => {
    c.assign(c.sub(l).mul(l.oneMinus()).div(x.sub(l)).add(l));
  });
  return c;
}).setLayout({ name: 'blendClip', type: 'vec3', inputs: [{ name: 'c', type: 'vec3' }] });

const setLum = Fn(([c, l]: [V3, F]) => clipColour(c.add(l.sub(lum(c))))).setLayout({
  name: 'blendSetLum',
  type: 'vec3',
  inputs: [
    { name: 'c', type: 'vec3' },
    { name: 'l', type: 'float' },
  ],
});

const sat = Fn(([c]: [V3]) => max(max(c.r, c.g), c.b).sub(min(min(c.r, c.g), c.b))).setLayout({
  name: 'blendSat',
  type: 'float',
  inputs: [{ name: 'c', type: 'vec3' }],
});

const setSat = Fn(([c, s]: [V3, F]) => {
  const n = min(min(c.r, c.g), c.b).toVar();
  const x = max(max(c.r, c.g), c.b).toVar();
  const out = vec3(0).toVar();
  If(x.greaterThan(n), () => {
    out.assign(c.sub(n).mul(s).div(x.sub(n)));
  });
  return out;
}).setLayout({
  name: 'blendSetSat',
  type: 'vec3',
  inputs: [
    { name: 'c', type: 'vec3' },
    { name: 's', type: 'float' },
  ],
});

const screen = (b: V3, s: V3) => b.add(s).sub(b.mul(s));

const hardLight = Fn(([b, s]: [V3, V3]) =>
  mix(b.mul(2).mul(s), screen(b, s.mul(2).sub(1)), step(0.5, s)),
).setLayout({
  name: 'blendHardLight',
  type: 'vec3',
  inputs: [
    { name: 'b', type: 'vec3' },
    { name: 's', type: 'vec3' },
  ],
});

const softLight = Fn(([b, s]: [V3, V3]) => {
  const d = mix(b.mul(16).sub(12).mul(b).add(4).mul(b), sqrt(b), step(0.25, b)).toVar();
  return mix(
    b.sub(s.mul(2).oneMinus().mul(b).mul(b.oneMinus())),
    b.add(s.mul(2).sub(1).mul(d.sub(b))),
    step(0.5, s),
  );
}).setLayout({
  name: 'blendSoftLight',
  type: 'vec3',
  inputs: [
    { name: 'b', type: 'vec3' },
    { name: 's', type: 'vec3' },
  ],
});

const colorBurn = Fn(([b, s]: [V3, V3]) => {
  const burnt = vec3(1)
    .sub(min(vec3(1), b.oneMinus().div(max(s, vec3(1e-5)))))
    .toVar();
  return mix(mix(burnt, vec3(0), step(s, vec3(0))), vec3(1), step(1, b));
}).setLayout({
  name: 'blendColorBurn',
  type: 'vec3',
  inputs: [
    { name: 'b', type: 'vec3' },
    { name: 's', type: 'vec3' },
  ],
});

const colorDodge = Fn(([b, s]: [V3, V3]) => {
  const dodged = min(vec3(1), b.div(max(s.oneMinus(), vec3(1e-5)))).toVar();
  return mix(mix(dodged, vec3(1), step(1, s)), vec3(0), step(b, vec3(0)));
}).setLayout({
  name: 'blendColorDodge',
  type: 'vec3',
  inputs: [
    { name: 'b', type: 'vec3' },
    { name: 's', type: 'vec3' },
  ],
});

/**
 * `blend(b, s, mode)`: a colour s blended over b the way `mode` says (0, and any unknown: multiply).
 * The modes that share a piece share one call of it: the colour modes (hue, saturation, colour,
 * luminosity) one set-saturation and set-luminosity, overlay and hard light one hard light (its
 * colours swapped), the burns and dodges one burn and one dodge (a function is written out again
 * wherever it is called: one call each keeps the shader small).
 */
export const blend = Fn(([b, s, mode]: [V3, V3, Node<'int'>]) => {
  const out = b.mul(s).toVar();
  If(mode.equal(1).or(mode.equal(2)).or(mode.equal(6)).or(mode.equal(14)), () => {
    // 1 hue: s's hue at b's saturation and luminosity... as the modes have them (1: s at b's
    // luminosity; 2: s at b's saturation and luminosity; 6: b at s's saturation, b's luminosity;
    // 14: b at s's luminosity).
    const satOf = mode.equal(2).or(mode.equal(6)).toVar();
    const into = select(mode.equal(1).or(mode.equal(2)), s, b).toVar();
    const shaped = vec3(into).toVar();
    If(satOf, () => {
      shaped.assign(setSat(into, sat(select(mode.equal(2), b, s))));
    });
    out.assign(setLum(shaped, lum(select(mode.equal(14), s, b))));
  })
    .ElseIf(mode.equal(3).or(mode.equal(11)), () => {
      // Overlay (3): hard light, backdrop and source swapped.
      const overlay = mode.equal(3).toVar();
      out.assign(hardLight(select(overlay, s, b), select(overlay, b, s)));
    })
    .ElseIf(mode.equal(5).or(mode.equal(10)).or(mode.equal(17)), () => {
      // Burn (5), dodge (10), and vivid light (17): burn below half, dodge above.
      const vivid = mode.equal(17).toVar();
      const burnt = colorBurn(b, select(vivid, s.mul(2), s)).toVar();
      const dodged = colorDodge(b, select(vivid, s.mul(2).sub(1), s)).toVar();
      out.assign(
        select(
          mode.equal(5),
          burnt,
          select(mode.equal(10), dodged, mix(burnt, dodged, step(0.5, s))),
        ),
      );
    })
    .ElseIf(mode.equal(4), () => {
      out.assign(softLight(b, s));
    })
    .ElseIf(mode.equal(7), () => {
      out.assign(screen(b, s));
    })
    .ElseIf(mode.equal(8), () => {
      out.assign(min(b, s));
    })
    .ElseIf(mode.equal(9), () => {
      out.assign(max(b, s));
    })
    .ElseIf(mode.equal(12), () => {
      out.assign(abs(b.sub(s)));
    })
    .ElseIf(mode.equal(13), () => {
      out.assign(b.add(s).sub(b.mul(s).mul(2)));
    })
    .ElseIf(mode.equal(15), () => {
      out.assign(min(b.add(s), vec3(1)));
    })
    .ElseIf(mode.equal(16), () => {
      out.assign(max(b.add(s).sub(1), vec3(0)));
    })
    .ElseIf(mode.equal(18), () => {
      out.assign(clamp(b.add(s.mul(2)).sub(1), 0, 1));
    })
    .ElseIf(mode.equal(19), () => {
      // Pin light.
      out.assign(mix(min(b, s.mul(2)), max(b, s.mul(2).sub(1)), step(0.5, s)));
    })
    .ElseIf(mode.equal(20), () => {
      out.assign(step(1, b.add(s)));
    })
    .ElseIf(mode.equal(21), () => {
      out.assign(max(b.sub(s), vec3(0)));
    })
    .ElseIf(mode.equal(22), () => {
      out.assign(mix(min(vec3(1), b.div(max(s, vec3(1e-5)))), vec3(1), step(s, vec3(0))));
    });
  return out;
}).setLayout({
  name: 'blend',
  type: 'vec3',
  inputs: [
    { name: 'b', type: 'vec3' },
    { name: 's', type: 'vec3' },
    { name: 'mode', type: 'int' },
  ],
});

/**
 * `tintBy(c, colour, mode, strength)`: a colour blended over c by the tint's strength; a colour
 * past white (HDR light) blended at its hue, keeping its brightness.
 */
export const tintBy = Fn(([c, colour, mode, strength]: [V3, V3, Node<'int'>, F]) => {
  const out = c.toVar();
  If(strength.greaterThan(0), () => {
    const m = max(max(c.r, c.g), c.b).toVar();
    const over = m.greaterThan(1).toVar();
    const n = select(over, c.div(m), c);
    const t = blend(n, colour, mode).toVar();
    out.assign(mix(c, select(over, t.mul(m), t), strength));
  });
  return out;
}).setLayout({
  name: 'tintBy',
  type: 'vec3',
  inputs: [
    { name: 'c', type: 'vec3' },
    { name: 'colour', type: 'vec3' },
    { name: 'mode', type: 'int' },
    { name: 'strength', type: 'float' },
  ],
});
