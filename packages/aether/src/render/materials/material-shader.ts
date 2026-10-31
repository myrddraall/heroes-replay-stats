import type { Node, Texture, TextureNode } from 'three/webgpu';
import {
  abs,
  clamp,
  dot,
  exp,
  float,
  If,
  int,
  length,
  Loop,
  max,
  min,
  mix,
  mod,
  normalize,
  pow,
  select,
  sign,
  smoothstep,
  sqrt,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { tintBy } from './blend-shader';
import { HALF_REACH } from '../../lights/lights';
import type { ShaderUniforms } from '../uniforms/shader-uniforms';

/**
 * A material as the game's standard material draws one, in three.js's shading language, its
 * uniforms by the names `UniformSet` sets them by (`ShaderUniforms`): the colour is the diffuse
 * layer (unshaded materials only; a lit one draws it by the light on it where it is lit here, a
 * flyby planet's, else nothing but its emissive) plus the emissive layer; the alpha is the alpha
 * masks' product (and the vertex alpha, where the material uses it).
 * Each layer reads its channel, in the mesh's first or second texture coordinates (its uvSet),
 * through its tiling about the texture's centre, less its offset (the offset moves the texture:
 * the scrolls then carry the energy inwards, as the game's sequence names it, and the nebula sits
 * where the game shows it), and its rotation. A layer's midtone offset lifts its middle values (a
 * gamma curve; the data doesn't say which curve, and it changes little here). A mask at its full
 * offset (1) cuts nothing out of an opaque material: the Play screen planets' birth masks run from
 * 0 (their hex dissolve, cut at half) to 1 as they are born and rest there, born whole (as the
 * game shows them), while what they fade (the birth glow) keeps its curve.
 *
 * A layer may be a colour of its own instead of a texture, and may fade by its fresnel: from its
 * minimum where the surface faces the camera to its maximum edge-on, the view first turned by its
 * yaw and pitch (the planets' hex grid brightens towards one side of their rims). The game's
 * fresnel comes out squared and brighter than that formula: measured against a Quick Match
 * screenshot, the planets' hex grid matches the formula's square times FRESNEL_GAIN, where the
 * formula alone left it all but invisible (the data doesn't say why); that was measured on the
 * grid's kind of fresnel (type 1); the inverted kind (type 2, the flyby planets' atmospheres and
 * city lights, strongest facing the camera) comes out squared too, without the gain: measured
 * against the tutorial's own shot of Azeroth, whose atmosphere shell (a colour layer and a mask
 * layer, both type 2) falls off from the body's limb as the game shows it only so. A mask layer's
 * fresnel scales its mask as the formula gives it, once. The emissive layer adds to the diffuse
 * colour, or multiplies it (mod, twice for mod2x). A blended material's output is premultiplied;
 * an opaque one's is cut out where its alpha falls below its threshold. A lit material (a flyby
 * planet's) takes its diffuse colour times the light on it: the ambient colour plus each light's
 * colour by how much of it reaches the surface, as the game's standard material is lit, and its
 * shine where it has a specular layer. A material that uses the vertex colour multiplies its
 * diffuse by it.
 *
 * One shader for every material of a kind of draw (a body's part, a sky mesh): what a material has
 * (a grid, a pattern, lights, shades, a layer's texture, a light's kind) is a branch on its
 * uniforms, never a shader of its own, so however materials are combined nothing new is compiled.
 * It is written so Direct3D's compiler, which writes every function out again wherever it is
 * called and unrolls any loop of a fixed length, keeps it small: each piece is called from one
 * place (one loop for every light, shade and grid field; one for the tints; one texture read per
 * sample), loops run to counts the uniforms give, and no derivative is taken inside one (the
 * texture coordinates' change across the pixel comes in, worked out before any loop). Every value
 * used more than once is a variable first: three.js writes an expression out again in each branch
 * of a `select` it is used in.
 */

/** The kinds of draw, each with a shader of its own: a body's part (lit, grids, patterns, shades) or a sky mesh (smeared in a fly). */
export type MaterialKind = 'body' | 'mesh';

/** A material's layer slots. */
export type Slot = 'diffuse' | 'emissive' | 'mask0' | 'mask1' | 'specular';
export const SLOTS: readonly Slot[] = ['diffuse', 'emissive', 'mask0', 'mask1', 'specular'];

/**
 * A material's textures: one node per slot, each the drawn draw's texture by its slot's name (its
 * `DrawValues`' textures, a slot's placeholder where it has none), and the sky light (a quarter of
 * its size: see `skyLightAt`). The shader is the same whichever textures they are. A draw given
 * other textures is a new object (WebGPU keeps an object's bindings, and may not bind a texture
 * swapped in after its first draw); its material, and program, are the same.
 */
export class TextureSlots {
  readonly nodes: Readonly<Record<Slot, TextureNode>>;
  readonly skyLight: TextureNode;

  constructor(u: ShaderUniforms, placeholders: Readonly<Record<Slot, Texture>>, skyLight: Texture) {
    this.nodes = Object.fromEntries(SLOTS.map((s) => [s, u.texture(s, placeholders[s])])) as Record<
      Slot,
      TextureNode
    >;
    this.skyLight = texture(skyLight) as unknown as TextureNode;
  }
}

/**
 * The point of a body's sphere (the unit sphere about its middle, in its frame) something at `pos`
 * sees nearest a point `q`: `q` itself where it faces it; past the side facing it, the nearest of
 * the edge it sees (where the sphere turns from it). A spot's cone is tested there, so its wrap
 * carries its light on round the body but never through it.
 */
export function seenFrom(pos: Node<'vec3'>, q: Node<'vec3'>): Node<'vec3'> {
  const out = vec3(q).toVar();
  const far = length(pos).toVar();
  const at = normalize(q).toVar();
  If(far.greaterThan(1).and(dot(at, pos.sub(at)).lessThan(0)), () => {
    const toward = pos.div(far).toVar();
    const across = at.sub(toward.mul(dot(at, toward))).toVar();
    const round = sqrt(float(1).sub(float(1).div(far.mul(far))));
    out.assign(
      toward.div(far).add(across.div(max(length(across), 1e-6)).mul(round)),
    );
  });
  return out;
}

/** What is shaded: the surface under the pixel, each a shader variable. */
export interface Surface {
  readonly uv: Node<'vec2'>;
  readonly uv2: Node<'vec2'>;
  readonly normal: Node<'vec3'>;
  readonly world: Node<'vec3'>;
  readonly color: Node<'vec4'>;
  /** How much of the pixel the shape covers. */
  readonly coverage: Node<'float'>;
  /** Past a sphere's outline (its textures read at their coarsest). */
  readonly pastOutline: Node<'bool'>;
}

/**
 * Each set of texture coordinates' change across the pixel (x and y), worked out before any loop
 * by `uvChange`, where they don't jump (the same coordinates wrapped elsewhere change less across
 * a wrap: a body's u round its sphere), so the wrap leaves no seam.
 */
export interface UvChange {
  readonly uvDx: Node<'vec2'>;
  readonly uvDy: Node<'vec2'>;
  readonly uv2Dx: Node<'vec2'>;
  readonly uv2Dy: Node<'vec2'>;
}

/** A shaded pixel: its colour, its glow, and whether it is cut out (an opaque material's alpha below its cutout). */
export interface Shaded {
  readonly colour: Node<'vec4'>;
  readonly glow: Node<'vec4'>;
  readonly cut: Node<'bool'>;
}

type Derivative = (n: Node<'vec2'>) => Node<'vec2'>;

/** How much brighter the game's fresnel (type 1) comes out than the formula's square: measured (see above). */
const FRESNEL_GAIN = 4.3;
const LUMA = [0.2126, 0.7152, 0.0722] as const;
/** The smear's taps across the sky's u (`texel`). */
const SMEAR_TAPS = 7;

/** One set of coordinates' change across the pixel, taken where they don't jump (see `UvChange`). */
function changeOf(uv: Node<'vec2'>, dFdx: Derivative, dFdy: Derivative) {
  const dx = dFdx(uv).toVar();
  const dy = dFdy(uv).toVar();
  const elsewhere = uv.add(0.5).fract().toVar();
  const dxb = dFdx(elsewhere).toVar();
  const dyb = dFdy(elsewhere).toVar();
  const wrapped = dot(dxb, dxb)
    .add(dot(dyb, dyb))
    .lessThan(dot(dx, dx).add(dot(dy, dy)))
    .toVar();
  return { dx: select(wrapped, dxb, dx).toVar(), dy: select(wrapped, dyb, dy).toVar() };
}

/** Both sets of coordinates' change across the pixel: taken where the shader runs no loop (see `UvChange`). */
export function uvChange(
  uv: Node<'vec2'>,
  uv2: Node<'vec2'>,
  dFdx: Derivative,
  dFdy: Derivative,
): UvChange {
  const a = changeOf(uv, dFdx, dFdy);
  const b = changeOf(uv2, dFdx, dFdy);
  return { uvDx: a.dx, uvDy: a.dy, uv2Dx: b.dx, uv2Dy: b.dy };
}

/** One layer's uniforms (`uLayers[i].*`). */
function layer(u: ShaderUniforms, i: number) {
  const at = (f: string) => `uLayers[${i}].${f}`;
  return {
    used: u.int(at('used')),
    textured: u.int(at('textured')),
    color: u.vec4(at('color')),
    uvSet: u.int(at('uvSet'), 1),
    channel: u.int(at('channel')),
    bright: u.float(at('bright'), 1),
    midtone: u.float(at('midtone')),
    offset: u.vec2(at('offset')),
    /** Its turn (its angle's cos and sin, worked out on the CPU: `DrawValues`). */
    spin: u.vec2(at('spin')),
    tiling: u.vec2(at('tiling')),
    fresnel: u.int(at('fresnel')),
    fExponent: u.float(at('fExponent'), 1),
    fMin: u.float(at('fMin')),
    fMax: u.float(at('fMax'), 1),
    /** Its fresnel's turn of the view (its lean and the body's rim turn, as a matrix: `DrawValues`). */
    view: u.mat3(at('view')),
  };
}
type Layer = ReturnType<typeof layer>;

/** A texel's channel: its colour (0, alpha 1), all of it (1), or one of its alpha, red, green, blue (2 to 5) in every component. */
function channelOf(texel: Node<'vec4'>, c: Node<'int'>): Node<'vec4'> {
  const one = select(
    c.equal(2),
    texel.a,
    select(c.equal(3), texel.r, select(c.equal(4), texel.g, texel.b)),
  );
  return select(c.equal(0), vec4(texel.rgb, 1), select(c.equal(1), texel, vec4(one))).toVar();
}

/** A value with its middle lifted by a midtone offset (a gamma curve; none at 0). */
const midtone = (v: Node<'vec4'>, m: Node<'float'>) =>
  select(m.greaterThan(0), pow(v, vec4(m.add(1).reciprocal())), v).toVar();

/** The material shaded at a surface: its colour, its glow, and whether it is cut out. */
export function shadeMaterial(
  u: ShaderUniforms,
  t: TextureSlots,
  kind: MaterialKind,
  s: Surface,
  change: UvChange,
): Shaded {
  const body = kind === 'body';
  const layers = [0, 1, 2, 3, 4].map((i) => layer(u, i)) as [Layer, Layer, Layer, Layer, Layer];
  const [L0, L1, L2, L3, L4] = layers;
  const eye = u.vec3('uEye');
  const right = u.vec3('uRight');
  const up = u.vec3('uUp');
  const spread = u.float('uSpread', -1);
  const falloff = u.float('uFalloff', 2);
  const opaque = u.int('uOpaque').equal(1).toVar();
  const n = normalize(s.normal).toVar();
  const toEye = normalize(eye.sub(s.world)).toVar();

  const turnOf = (l: Layer) => ({ c: l.spin.x, sn: l.spin.y });
  /** A layer's texture coordinates, the mesh's shifted by du along u first (the sky's go right round). */
  const layerUvFrom = (l: Layer, du: Node<'float'> | number) => {
    const base = select(l.uvSet.equal(2), s.uv2, s.uv);
    const tt = base.add(vec2(du, 0)).sub(0.5).sub(l.offset).mul(l.tiling).toVar();
    const { c, sn } = turnOf(l);
    return vec2(c.mul(tt.x).sub(sn.mul(tt.y)), sn.mul(tt.x).add(c.mul(tt.y)))
      .add(0.5)
      .toVar();
  };
  /** A layer's coordinates' change along a change of the mesh's (through its tiling and its turn). */
  const layerChange = (l: Layer, d: Node<'vec2'>) => {
    const { c, sn } = turnOf(l);
    const dd = d.mul(l.tiling).toVar();
    return vec2(c.mul(dd.x).sub(sn.mul(dd.y)), sn.mul(dd.x).add(c.mul(dd.y)));
  };
  /** A layer's texel at uv, read at the pixel's change (one read: past the outline, at its coarsest). */
  const sampled = (slot: Slot, l: Layer, uv: Node<'vec2'>) => {
    const second = l.uvSet.equal(2).toVar();
    const gx = select(
      s.pastOutline,
      vec2(1, 0),
      layerChange(l, select(second, change.uv2Dx, change.uvDx)),
    ).toVar();
    const gy = select(
      s.pastOutline,
      vec2(0, 1),
      layerChange(l, select(second, change.uv2Dy, change.uvDy)),
    ).toVar();
    return t.nodes[slot].sample(uv).grad(gx, gy).toVar();
  };
  /**
   * A layer's texel; on a sky mesh smeared across its u by uSmear (of the way round the sky: the
   * same sweep for every layer whatever its tiling) as the view sweeps in a fly (a loop to as many
   * taps as it takes).
   */
  const texel = (slot: Slot, l: Layer) => {
    if (body) return sampled(slot, l, layerUvFrom(l, 0));
    const smear = u.float('uSmear');
    const smeared = smear.greaterThan(0).toVar();
    const taps = select(smeared, int(SMEAR_TAPS), int(1)).toVar();
    const first = select(smeared, float(-(SMEAR_TAPS - 1) / 2), float(0)).toVar();
    const sum = vec4(0).toVar();
    Loop(taps, ({ i }) => {
      sum.addAssign(sampled(slot, l, layerUvFrom(l, smear.mul(first.add(float(i))).div(3))));
    });
    return sum.div(float(taps)).toVar();
  };
  /**
   * The formula's fresnel, the way to the eye turned (`view`: its lean's turn, or a rim's): from the
   * layer's minimum facing the camera to its maximum edge-on (type 1), or the other way about (type
   * 2: the facing itself to the exponent, so a low exponent keeps it up nearly to the limb, as the
   * flyby's city lights stay in view in the tutorial's shots). Spread, where set, stands in for the
   * layer's minimum, so what shows at the limb shows across the face; 0 is nothing but the limb.
   */
  const fresnelWith = (
    l: Layer,
    view: Node<'vec3'>,
    spreadOf: Node<'float'>,
    type: Node<'int'>,
  ) => {
    const facing = clamp(dot(n, view), 0, 1).toVar();
    const low = select(spreadOf.lessThan(0), l.fMin, spreadOf.mul(l.fMax));
    return mix(
      low,
      l.fMax,
      pow(select(type.equal(2), facing, facing.oneMinus()), l.fExponent),
    ).toVar();
  };
  /** A colour layer's fresnel as the game shows it (squared, type 1 with the gain), to a falloff. */
  const fresnelTo = (
    l: Layer,
    view: Node<'vec3'>,
    spreadOf: Node<'float'>,
    fall: Node<'float'>,
    type: Node<'int'>,
  ) => {
    const w = fresnelWith(l, view, spreadOf, type);
    return select(type.equal(2), w.mul(w), pow(w, fall).mul(FRESNEL_GAIN)).toVar();
  };
  /** A colour layer's fresnel, its own: to the material's falloff (2, as measured on the planets' grid, unless set). */
  const fresnel = (l: Layer) => {
    const out = float(1).toVar();
    If(l.fresnel.notEqual(0), () => {
      out.assign(fresnelTo(l, l.view.mul(toEye), spread, falloff, l.fresnel));
    });
    return out;
  };
  /** A colour layer: its texel's channel (or its own colour), its middle lifted, by its brightness and fresnel. */
  const colorLayer = (slot: Slot, l: Layer) => {
    const out = vec4(0, 0, 0, 1).toVar();
    If(l.used.equal(1), () => {
      const v = l.color.toVar();
      If(l.textured.equal(1), () => {
        v.assign(midtone(channelOf(texel(slot, l), l.channel), l.midtone));
      });
      out.assign(vec4(v.rgb.mul(l.bright).mul(fresnel(l)), v.a));
    });
    return out;
  };
  /** A mask layer's alpha, scaled by its fresnel as the formula gives it. */
  const maskLayer = (slot: Slot, l: Layer) => {
    const out = float(1).toVar();
    // (Fully born: nothing cut out.)
    const born = opaque.and(l.midtone.greaterThanEqual(1));
    If(l.used.equal(1).and(born.not()), () => {
      const v = clamp(
        channelOf(sampled(slot, l, layerUvFrom(l, 0)), l.channel).a.mul(l.bright),
        0,
        1,
      );
      const m = midtone(vec4(v), l.midtone).a.toVar();
      If(l.fresnel.notEqual(0), () => {
        m.mulAssign(clamp(fresnelWith(l, l.view.mul(toEye), spread, l.fresnel), 0, 1));
      });
      out.assign(m);
    });
    return out;
  };
  /**
   * The sky's colour beyond a body's edge the way a normal points across the view, spread radii out
   * from its middle: read from the sky round the bodies (what doesn't move of it, small and
   * blurred: a frame's worth; its quarter-size copy, two mipmap levels down), where this body is in
   * it (`uSkyAt`: its middle, and one radius across and up, as shares of the frame).
   */
  const skyLightAt = (dirN: Node<'vec3'>, spreadOf: Node<'float'>) => {
    const at = u.vec4('uSkyAt');
    const uv = at.xy.add(vec2(dot(dirN, right), dot(dirN, up)).mul(at.zw).mul(spreadOf.add(1)));
    return t.skyLight.sample(clamp(uv, 0, 1)).level(float(0)).rgb;
  };
  const revealed = u.int('uRevealed').equal(1).toVar();
  const rimType = u.int('uRimType');
  /**
   * How much a light reaches the point facing nn, and the way to it: (to, reach). One from a side
   * (kind 0) by how squarely the point faces it (to the power of its softness), wrapped round by
   * wrap (0: the half facing it; 1: on round to the point facing away); one from a point (1) or a
   * spot (2) by that and how far away it is (none at fade, its range: half as strong `HALF_REACH`
   * of the way, smoothed down to nothing at its range), a spot only within its cone,
   * fading in over its edge; one from above and below (3) by how far the point faces the side it
   * comes from (0 the other way, 1 squarely: its colours mixed by it); the sky round the body (4) by
   * how far the point faces away from the eye (none facing it squarely, all at the edge and behind,
   * to the power of its softness: the sky lights the body's edges); the rim (5) as below. The sky
   * round the body reads nothing of the sky here (`skyLightAt` does, where its colour counts).
   * A rim's turn of the view (`rimTurned`) is read only where the light is a rim. A spot's cone
   * comes apart from its reach (`edge`: 1 for any other light), and its softness is the
   * cone's, not its facing's: a light or a shade takes the two together, a grid's field its own way.
   */
  const reachOf = (
    kindOf: Node<'int'>,
    dir: Node<'vec3'>,
    pos: Node<'vec3'>,
    fade: Node<'float'>,
    aim: Node<'vec3'>,
    cone: Node<'vec4'>,
    softness: Node<'float'>,
    wrap: Node<'float'>,
    nn: Node<'vec3'>,
    rimTurned: () => Node<'vec3'>,
    edge: Node<'float'>,
    coneSoftness: Node<'float'>,
  ) => {
    const out = vec4(0).toVar();
    If(kindOf.equal(0).or(kindOf.equal(3)), () => {
      const side = normalize(dir).negate().toVar();
      const facing = dot(nn, side).toVar();
      If(kindOf.equal(0), () => {
        out.assign(vec4(side, pow(clamp(facing.add(wrap).div(wrap.add(1)), 0, 1), softness)));
      }).Else(() => {
        out.assign(vec4(side, facing.mul(0.5).add(0.5)));
      });
    })
      .ElseIf(kindOf.equal(5), () => {
        // The rim: a grid's its pattern layer's fresnel look (its rim light draws it); else the
        // surface by how far it turns from the eye (the view leaned by its aim), spread fade of
        // the way in, to its softness.
        const r = float(0).toVar();
        const view = rimTurned().toVar();
        If(revealed, () => {
          r.assign(fresnelTo(L1, view, fade, softness, rimType));
        }).Else(() => {
          const facing = clamp(dot(nn, normalize(view)), 0, 1).toVar();
          r.assign(pow(mix(fade, 1, pow(facing.oneMinus(), 3)), softness));
        });
        out.assign(vec4(nn, r));
      })
      .ElseIf(kindOf.equal(4), () => {
        out.assign(vec4(nn, pow(clamp(dot(nn, normalize(eye)).oneMinus(), 0, 1), softness)));
      })
      .Else(() => {
        const d = pos.sub(s.world).toVar();
        const dist = max(length(d), 1e-6).toVar();
        const to = d.div(dist).toVar();
        const facing = clamp(dot(nn, to).add(wrap).div(wrap.add(1)), 0, 1).toVar();
        const spot = kindOf.equal(2).toVar();
        const r2 = dist.mul(dist).div(fade.mul(fade)).toVar();
        const ends = clamp(r2.mul(r2).oneMinus(), 0, 1).toVar();
        const strength = pow(facing, softness)
          .div(r2.div(HALF_REACH * HALF_REACH).add(1))
          .mul(ends.mul(ends))
          .toVar();
        // A spot's cone: all of it in to where its fade starts (cone.y, its Edge in from its edge),
        // falling off to nothing at its edge (cone.x); a grid's field's faster the higher its
        // softness (`coneSoftness`; a light's, its Edge alone); a cone with no edge to fade over
        // cut at its edge (smoothstep's result is undefined where its edges meet).
        If(spot, () => {
          // (Its cone where it reaches: past the side facing it, where its wrap carries it on, the
          // cone is as at the edge it sees nearest, never through the body to its far side.)
          const along = dot(normalize(pos.sub(seenFrom(pos, s.world))).negate(), aim).toVar();
          const within = float(0).toVar();
          If(cone.y.greaterThan(cone.x), () => {
            within.assign(smoothstep(cone.x, cone.y, along));
          }).Else(() => {
            within.assign(step(cone.x, along));
          });
          (edge as unknown as { assign(v: Node<'float'>): void }).assign(pow(within, coneSoftness));
        });
        out.assign(vec4(to, strength));
      });
    return out;
  };

  // The layers first: the diffuse, and the specular map the lights shine on.
  const diffuse = colorLayer('diffuse', L0);
  If(u.int('uVertexColor').equal(1), () => {
    diffuse.assign(vec4(diffuse.rgb.mul(s.color.rgb), diffuse.a));
  });

  // Every light, shade, reveal and activation on a body, in one loop (`reaches`, packed by
  // `ShaderUniforms`), each reach worked out once: the light on it and its shine (Blinn-Phong),
  // how dark its shades make it, how active its grid is (and how much brighter it shines), and how
  // much of it its grid's lights reveal.
  const light = vec3(0).toVar();
  const shine = vec3(0).toVar();
  const dark = vec3(1).toVar();
  const active = float(0).toVar();
  const activeGlow = float(0).toVar();
  const reveal = float(1).toVar();
  const specMap = vec3(0).toVar();
  if (body) {
    If(L4.used.equal(1), () => {
      specMap.assign(colorLayer('specular', L4).rgb.mul(u.float('uSpecularMult')));
    });
    const shines = dot(specMap, specMap).greaterThan(0).toVar();
    const specularity = u.float('uSpecularity');
    const revealSum = float(0).toVar();
    light.assign(u.vec3('uAmbient'));
    Loop(u.int('uReachCount'), ({ i }) => {
      const row = (r: number) => u.row('reaches', i, r);
      const r0 = row(0).toVar();
      const r1 = row(1).toVar();
      const r2 = row(2).toVar();
      const r3 = row(3).toVar();
      const r4 = row(4).toVar();
      const amount = row(7).toVar();
      const role = int(r4.w).toVar();
      const k = int(r1.w).toVar();
      // (A shade or a field from all round: all of it alike.)
      const reach = float(1).toVar();
      const edge = float(1).toVar();
      const to = vec3(0).toVar();
      If(role.equal(0).or(k.notEqual(0)).or(dot(r0.xyz, r0.xyz).notEqual(0)), () => {
        // (A rim's turn of the view: rows 8 to 10, its matrix's.)
        const rimTurned = () =>
          vec3(dot(row(8).xyz, toEye), dot(row(9).xyz, toEye), dot(row(10).xyz, toEye));
        // How sharply it falls off round: a light's or a shade's from a side, a point or a spot, as
        // its material says (Drop off); a grid's field's, and the sky's and the rim's, their own
        // (a field from a spot shaped by its cone alone).
        const field = role.greaterThanEqual(2).toVar();
        const surface = select(field, r0.w, u.float('uDropOff'));
        const facingSoftness = select(field.and(k.equal(2)), float(1), surface);
        const r = reachOf(
          k,
          r0.xyz,
          r3.xyz,
          r2.w,
          r4.xyz,
          row(6),
          select(k.greaterThanEqual(3), r0.w, facingSoftness),
          // (How far round: a light or a shade, as its material lets it; a grid's field, its own
          // spread.)
          select(role.greaterThanEqual(2), r3.w, u.float('uWrap')),
          n,
          rimTurned,
          edge,
          select(field, r0.w, float(1)),
        ).toVar();
        reach.assign(r.w);
        to.assign(r.xyz);
      });
      // A light's or a shade's reach, its cone's edge with it.
      const lit = reach.mul(edge).toVar();
      const sky = vec3(1).toVar();
      If(k.equal(4), () => {
        sky.assign(skyLightAt(n, r2.w));
      });
      If(role.equal(0), () => {
        If(k.equal(3), () => {
          light.addAssign(mix(row(5).xyz, r1.xyz, reach));
        }).Else(() => {
          light.addAssign(r1.xyz.mul(sky).mul(lit));
          If(k.notEqual(4).and(shines).and(lit.greaterThan(0)), () => {
            const highlight = pow(max(0, dot(n, normalize(to.add(toEye)))), specularity);
            shine.addAssign(r2.xyz.mul(highlight).mul(select(k.equal(0), float(1), lit)));
          });
        });
      })
        .ElseIf(role.equal(1), () => {
          If(amount.x.greaterThan(0), () => {
            dark.mulAssign(vec3(1).sub(r1.xyz.mul(sky).mul(lit).mul(amount.x)));
          });
        })
        .Else(() => {
          // A grid's field: how much its reveal or activation reaches here, as the same light
          // would reach a body (from a side wrapped round by its wrap and sharpened by its falloff;
          // from a point, above and below, the sky or the rim likewise), times its strength (more
          // than 1 reaches further fully); what it reaches never comes out even: its side and its
          // falloff always tell (one that darkens: taken away). A spot's cone alone shapes it, its
          // strength, how squarely the grid faces it and how far it is saying how fully (up to
          // full), so a strong spot fills its cone without hardening its edge; the sky's by how
          // bright the sky is that way. An activation's activates (0 to 1 in all), glows (how much
          // brighter it shines, and blooms) and reveals too, as much as it energizes.
          const strength = amount.x;
          const f = select(
            k.equal(2),
            edge.mul(sign(strength)).mul(min(abs(strength).mul(reach), 1)),
            strength.mul(select(k.equal(4), reach.mul(dot(sky, vec3(...LUMA))), reach)),
          ).toVar();
          If(role.equal(2), () => {
            revealSum.addAssign(f);
          }).Else(() => {
            active.addAssign(f);
            activeGlow.addAssign(amount.z.mul(min(f, 1)));
            revealSum.addAssign(amount.y.mul(f));
          });
        });
    });
    active.assign(clamp(active, 0, 1));
    activeGlow.assign(max(activeGlow, 0));
    // How much of a grid shows (its reveal, as the eye sees it: half revealed looks half as bright,
    // so a light's fall-off reads across its reach).
    If(revealed, () => {
      reveal.assign(pow(clamp(revealSum, 0, 1), 2.2));
    });
    // A grid's colour, from inactive (its own) towards active where its activation reaches.
    If(u.int('uActivationCount').greaterThan(0), () => {
      diffuse.assign(
        vec4(mix(diffuse.rgb, u.vec3('uActiveColor').mul(L0.bright), active), diffuse.a),
      );
    });
  }

  // The emissive layer, or (a body's) a drawn hex pattern in its place: its edges smoothed over the
  // pixel by how the edge changes across it (the coordinates' change along the edge's gradient).
  const emissive = vec4(0, 0, 0, 1).toVar();
  if (body) {
    If(u.int('uPattern').equal(1), () => {
      If(L1.used.equal(1), () => {
        const params = u.vec3('uPatternParams');
        const scale = vec2(1, 0.5).mul(params.x).toVar();
        const p = s.uv.mul(scale).toVar();
        const px = change.uvDx.mul(scale).toVar();
        const py = change.uvDy.mul(scale).toVar();
        const r = vec2(1, 1.7320508);
        const side = vec2(0.5, 0.8660254);
        const h = r.mul(0.5);
        const a = mod(p, r).sub(h).toVar();
        const b = mod(p.sub(h), r).sub(h).toVar();
        const q = select(dot(a, a).lessThan(dot(b, b)), a, b).toVar();
        const c = abs(q).toVar();
        const slanted = dot(c, side).greaterThan(c.x).toVar();
        const edge = float(0.5)
          .sub(select(slanted, dot(c, side), c.x))
          .toVar();
        // (The edge falls one for one with p across the nearer side: its gradient that side's normal.)
        const grad = q
          .sign()
          .negate()
          .mul(select(slanted, side, vec2(1, 0)))
          .toVar();
        const aa = abs(dot(grad, px))
          .add(abs(dot(grad, py)))
          .toVar();
        const width = params.y;
        const line = smoothstep(width.sub(aa), width.add(aa), edge).oneMinus();
        const halo = params.z.mul(exp(max(edge.sub(width), 0).mul(-6)));
        emissive.assign(vec4(vec3(max(line, halo)).mul(L1.bright).mul(fresnel(L1)), 1));
      });
    }).Else(() => {
      emissive.assign(colorLayer('emissive', L1));
    });
  } else {
    emissive.assign(colorLayer('emissive', L1));
  }

  // Unshaded: its diffuse; lit: by the light on it, and the shine; then darkened by its shades.
  const base = vec3(0).toVar();
  If(u.int('uUnshaded').equal(1), () => {
    base.assign(diffuse.rgb);
  });
  if (body) {
    If(u.int('uUnshaded').equal(0).and(u.int('uLit').equal(1)), () => {
      base.assign(diffuse.rgb.mul(light).add(shine.mul(specMap)).mul(u.float('uLightScale', 1)));
    });
    base.mulAssign(dark);
  }

  // The glow: a grid's Glow up to 1 dims its look, past 1 only blooms (past), revealing nothing
  // more. The emissive pattern cut: what is below the cut goes black, the rest keeps its range. A
  // grid shines brighter, and blooms more, where its glowing activation activates it.
  const emissiveMult = u.float('uEmissiveMult', 1);
  const past = float(0).toVar();
  const glow = emissive.rgb.mul(emissiveMult).toVar();
  if (body) {
    If(revealed, () => {
      past.assign(max(emissiveMult.sub(1), 0));
      glow.assign(emissive.rgb.mul(min(emissiveMult, 1)));
    });
  }
  const cutAt = u.float('uCut');
  If(cutAt.greaterThan(0), () => {
    glow.assign(max(glow.sub(cutAt), 0).div(cutAt.oneMinus()));
  });
  glow.mulAssign(activeGlow.add(1));
  const emissiveBlend = u.int('uEmissiveBlend', 2);
  const added = emissiveBlend.equal(2).toVar();
  const rgb = base.add(glow).toVar();
  If(added.not(), () => {
    rgb.assign(base.mul(glow).mul(select(emissiveBlend.equal(1), 2, 1)));
  });
  // The tints (the material's, then its body's) over the colour, and over the glow where it is
  // added: in one loop, one tint in it (pass i: the colour for 0 and 1, the glow for 2 and 3; the
  // body's tint for odd i).
  const tintedGlow = glow.toVar();
  const tints = select(added, int(4), int(2)).toVar();
  Loop(tints, ({ i }) => {
    const ofBody = i.equal(1).or(i.equal(3)).toVar();
    const onColour = i.lessThan(2).toVar();
    const tinted = tintBy(
      select(onColour, rgb, tintedGlow),
      select(ofBody, u.vec3('uBodyTintColor'), u.vec3('uTintColor')),
      select(ofBody, u.int('uBodyTintBlend'), u.int('uTintBlend')),
      select(ofBody, u.float('uBodyTintStrength'), u.float('uTintStrength')),
    ).toVar();
    If(onColour, () => {
      rgb.assign(tinted);
    }).Else(() => {
      tintedGlow.assign(tinted);
    });
  });
  // What a grid's lights reveal of it: that much of its look, no brighter than white (what is
  // brighter blooms, below, as much of it as is revealed).
  if (body) {
    If(revealed, () => {
      rgb.assign(min(rgb, vec3(1)).mul(reveal));
    });
  }

  const alpha = maskLayer('mask0', L2).mul(maskLayer('mask1', L3)).mul(diffuse.a).toVar();
  If(u.int('uVertexAlpha').equal(1), () => {
    alpha.mulAssign(s.color.a);
  });
  // (A part shown less strongly: its blended materials fainter.)
  If(opaque.not(), () => {
    alpha.mulAssign(u.float('uStrength', 1));
  });
  // Opaque: cut out below its cutout, and blended at its edge by how much of the pixel it covers;
  // blended: premultiplied, by its alpha and its coverage.
  const cut = opaque.and(alpha.lessThan(u.float('uCutout'))).toVar();
  const covered = select(opaque, s.coverage, alpha.mul(s.coverage)).toVar();
  const colour = vec4(rgb.mul(covered), covered).toVar();

  // What blooms under its own light's threshold that the scene's wouldn't (the glow up to 1 of it:
  // 0 none, 1 as the data has it), and past 1 its emissive light boosted (a glow as if through
  // haze): the bloom adds them. Below 1 the glow also takes back as much of what the scene's own
  // bloom would make of this light, so at 0 it glows not at all. The light is the emissive
  // layer's, or the colour it modulates (a grid over a colour glows in that colour); a grid's Glow
  // past 1 blooms it that much more, as much of it as is revealed.
  const shineOut = select(added, tintedGlow.mul(reveal), rgb).toVar();
  const boost = u.float('uGlowBoost', 1);
  const glowOut = vec4(
    max(colour.rgb.sub(u.float('uGlowThreshold')), 0)
      .mul(min(boost, 1))
      .sub(max(colour.rgb.sub(u.float('uSceneThreshold')), 0))
      .add(shineOut.mul(max(boost.sub(1), 0).add(activeGlow).add(past)).mul(covered)),
    colour.a,
  ).toVar();
  return { colour, glow: glowOut, cut };
}
