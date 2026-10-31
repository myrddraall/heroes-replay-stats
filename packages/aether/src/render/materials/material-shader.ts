import type { Node, Texture, TextureNode } from 'three/webgpu';
import {
  abs,
  acos,
  asin,
  clamp,
  cos,
  cross,
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
import { channelOn, tintRun } from './tint-shader';
import { nearestPlates, plateEdge } from './plates';
import { MAX_TINTS } from '../uniforms/limits';
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
  /** A body's normal's change across the pixel (for a drawn pattern on its sphere: none, none drawn). */
  readonly nDx?: Node<'vec3'>;
  readonly nDy?: Node<'vec3'>;
}

/** A shaded pixel: its colour, its glow, and whether it is cut out (an opaque material's alpha below its cutout). */
export interface Shaded {
  readonly colour: Node<'vec4'>;
  readonly glow: Node<'vec4'>;
  readonly cut: Node<'bool'>;
}

type Derivative = (n: Node<'vec2'>) => Node<'vec2'>;

/** How much of an activation's colour and glow a grid's plates take, its lines taking all of it. */
const ACTIVATED_PLATES = 0.25;

/**
 * The Play screen planets' grid texture (Storm_LootUI_Grid_Diff, its green channel as the shield
 * reads it), across one of its plate's edges, in plates from the edge (0.5 its middle): a fill all
 * over, a line along the edge and a glow inside it, each a gaussian of its width about the edge.
 * Fitted to its profile (averaged over its vertical edges), within 0.003 everywhere; its fine
 * triangles inside each plate left out.
 */
const PLATE_LOOK = { fill: 0.1956, line: 0.077, lineWidth: 0.0168, glow: 0.1207, glowWidth: 0.0891 };
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
   * A rim's turn of the view (`rimTurned`) is read only where the light is a rim. Its reach as it
   * would be widened (`widen`: wrapped further round, its cone wider by that much of the body's
   * size as it sees it, spread further in from its rim) into `wide`, its cone's edge with it. A spot's cone
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
    widen: Node<'float'>,
    wide: Node<'float'>,
  ) => {
    const out = vec4(0).toVar();
    // (How far it reaches widened by `widen`, its cone's edge with it, into `wide`.)
    const widened = wide as unknown as { assign(v: Node<'float'>): void };
    If(kindOf.equal(0).or(kindOf.equal(3)), () => {
      const side = normalize(dir).negate().toVar();
      const facing = dot(nn, side).toVar();
      If(kindOf.equal(0), () => {
        const wraps = (by: Node<'float'>) =>
          pow(clamp(facing.add(by).div(by.add(1)), 0, 1), softness);
        out.assign(vec4(side, wraps(wrap)));
        widened.assign(wraps(wrap.add(widen)));
      }).Else(() => {
        out.assign(vec4(side, facing.mul(0.5).add(0.5)));
        widened.assign(out.w);
      });
    })
      .ElseIf(kindOf.equal(5), () => {
        // The rim: a grid's its pattern layer's fresnel look (its rim light draws it); else the
        // surface by how far it turns from the eye (the view leaned by its aim), spread fade of
        // the way in, to its softness.
        const r = float(0).toVar();
        const rw = float(0).toVar();
        const view = rimTurned().toVar();
        const fadeWide = min(fade.add(widen), 1).toVar();
        If(revealed, () => {
          r.assign(fresnelTo(L1, view, fade, softness, rimType));
          rw.assign(fresnelTo(L1, view, fadeWide, softness, rimType));
        }).Else(() => {
          const facing = clamp(dot(nn, normalize(view)), 0, 1).toVar();
          const edgeOn = pow(facing.oneMinus(), 3).toVar();
          r.assign(pow(mix(fade, 1, edgeOn), softness));
          rw.assign(pow(mix(fadeWide, 1, edgeOn), softness));
        });
        out.assign(vec4(nn, r));
        widened.assign(rw);
      })
      .ElseIf(kindOf.equal(4), () => {
        out.assign(vec4(nn, pow(clamp(dot(nn, normalize(eye)).oneMinus(), 0, 1), softness)));
        widened.assign(out.w);
      })
      .Else(() => {
        const d = pos.sub(s.world).toVar();
        const dist = max(length(d), 1e-6).toVar();
        const to = d.div(dist).toVar();
        const facingBy = (by: Node<'float'>) => clamp(dot(nn, to).add(by).div(by.add(1)), 0, 1);
        const spot = kindOf.equal(2).toVar();
        const r2 = dist.mul(dist).div(fade.mul(fade)).toVar();
        const ends = clamp(r2.mul(r2).oneMinus(), 0, 1).toVar();
        const far = r2.div(HALF_REACH * HALF_REACH).add(1).reciprocal().mul(ends.mul(ends)).toVar();
        const strength = pow(facingBy(wrap), softness).mul(far).toVar();
        widened.assign(pow(facingBy(wrap.add(widen)), softness).mul(far));
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
          // (Widened: its cone's edge further out by `widen` of the body's size as the light sees it
          // (its angle across the body's radius: the same whatever the cone), never past square.)
          const across = asin(min(length(pos).reciprocal(), 1)).toVar();
          const outer = cos(
            min(acos(clamp(cone.x, -1, 1)).add(across.mul(widen)), Math.PI / 2),
          ).toVar();
          const inner = max(cone.y, outer).toVar();
          const withinWide = select(
            inner.greaterThan(outer),
            smoothstep(outer, inner, along),
            step(outer, along),
          );
          widened.assign(wide.mul(pow(withinWide, coneSoftness)));
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
  // How bright a grid shows: its look times this (1 for anything not a grid); a grid's, what its
  // lights reveal of it, each its strength times how far it reaches there (a rim's, its pattern
  // layer's fresnel as the game draws it), added and not capped: past 1 brighter, its limb past
  // white and blooming, as a light's strength brightens what it lights.
  const reveal = float(1).toVar();
  // (What its activations reveal of it where they activate it: how bright their active colour
  // shows, whatever its reveal lights do; see below.)
  const activeReveal = float(0).toVar();
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
      const reachWide = float(1).toVar();
      // (An activation's reveal reaches as much further as it energizes: see below. A variable
      // before any branch reads it: a node first worked out inside one branch is not set in another.)
      const widen = select(role.equal(3), amount.y, float(0)).toVar();
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
        // (Each a variable before `reachOf` branches on its kind, as `widen` is.)
        const softness = select(k.greaterThanEqual(3), r0.w, facingSoftness).toVar();
        // (How far round: a light or a shade, as its material lets it; a grid's field, its own
        // spread.)
        const wrap = select(role.greaterThanEqual(2), r3.w, u.float('uWrap')).toVar();
        const coneSoftness = select(field, r0.w, float(1)).toVar();
        const r = reachOf(
          k,
          r0.xyz,
          r3.xyz,
          r2.w,
          r4.xyz,
          row(6),
          softness,
          wrap,
          n,
          rimTurned,
          edge,
          coneSoftness,
          widen,
          reachWide,
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
          // from a point, above and below, the sky or the rim likewise), times its strength, as a
          // light's (one that darkens: taken away). A spot's cone shapes it, its edge by its
          // falloff; the sky's by how bright the sky is that way. An activation's activates (0 to
          // 1 in all), glows (its active colour brighter, and blooming) and reveals too, further
          // than it activates by as much as it energizes.
          const strength = amount.x;
          const f = strength
            .mul(select(k.equal(4), reach.mul(dot(sky, vec3(...LUMA))), reach))
            .mul(select(k.equal(2), edge, float(1)))
            .toVar();
          If(role.equal(2), () => {
            revealSum.addAssign(f);
          }).Else(() => {
            // (How much it activates, 0 to 1: a spot's full in its cone however strong, its edge
            // shaping it still; its glow, as much as it activates.)
            const activates = select(
              k.equal(2),
              edge.mul(sign(strength)).mul(min(abs(strength).mul(reach), 1)),
              f,
            ).toVar();
            active.addAssign(activates);
            activeGlow.addAssign(amount.z.mul(clamp(activates, 0, 1)));
            activeReveal.addAssign(f);
            // It reveals as a reveal light would, as much further than it activates as it
            // energizes (its reach widened: round, out of its cone, in from its rim).
            revealSum.addAssign(
              strength.mul(select(k.equal(4), reachWide.mul(dot(sky, vec3(...LUMA))), reachWide)),
            );
          });
        });
    });
    active.assign(clamp(active, 0, 1));
    activeGlow.assign(max(activeGlow, 0));
    // How bright a grid shows: what its lights reveal (none below nothing: what darkens takes away).
    If(revealed, () => {
      reveal.assign(max(revealSum, 0));
    });
  }

  // The emissive layer, or (a body's) a drawn shell of flat hex plates in its place (`plates`),
  // laid out about its texture's pole, standing for its grid texture: a plate's fill, then the line
  // where two plates meet and its glow inside them, as the game's grid texture has them (measured
  // in it: `PLATE_LOOK`), its line's width and its glow by the pattern's Width and Soft (1: the
  // game's); each smoothed over the pixel (its change across it, `nDx` and `nDy`); its middle lifted
  // as the texture's would be.
  const emissive = vec4(0, 0, 0, 1).toVar();
  // (A drawn grid's value before it is lifted, for where its activation reaches its lines.)
  const gridValue = float(-1).toVar();
  if (body) {
    If(u.int('uPattern').equal(1), () => {
      If(L1.used.equal(1), () => {
        const params = u.vec3('uPatternParams');
        const pole = u.vec3('uMap.pole');
        const meridian = u.vec3('uMap.meridian');
        const side = cross(pole, meridian).toVar();
        const intoPattern = (v: Node<'vec3'>) => vec3(dot(v, meridian), dot(v, side), dot(v, pole));
        const p = normalize(intoPattern(n)).toVar();
        const { near, next } = nearestPlates(p, params.x);
        const { edge, grows } = plateEdge(p, near, next);
        const blur = abs(dot(intoPattern(change.nDx ?? vec3(0)), grows))
          .add(abs(dot(intoPattern(change.nDy ?? vec3(0)), grows)))
          .toVar();
        // A gaussian about the edge, widened by the pixel's blur (as bright in all).
        const about = (height: number, width: Node<'float'>) => {
          const w = sqrt(width.mul(width).add(blur.mul(blur))).toVar();
          return width.div(w).mul(height).mul(exp(max(edge, 0).div(w).pow(2).negate()));
        };
        const value = float(PLATE_LOOK.fill)
          .add(about(PLATE_LOOK.line, params.y.mul(PLATE_LOOK.lineWidth)))
          .add(about(PLATE_LOOK.glow, float(PLATE_LOOK.glowWidth)).mul(params.z))
          .toVar();
        gridValue.assign(value);
        const lifted = midtone(vec4(value), L1.midtone).x;
        emissive.assign(vec4(vec3(lifted).mul(L1.bright).mul(fresnel(L1)), 1));
      });
    }).Else(() => {
      emissive.assign(colorLayer('emissive', L1));
    });
  } else {
    emissive.assign(colorLayer('emissive', L1));
  }

  // A grid's colour, from inactive (its own) towards active where its activation reaches: its lines
  // fully, its plates by a share (`ACTIVATED_PLATES`); how much of the pixel is line (and its glow)
  // read from the grid's value between its plate's fill and its edge (`PLATE_LOOK`: a drawn grid's
  // as drawn, the game's texture's as read). Its activations' glow brightens the active colour
  // alone (as much as each activates: their glow on average), and blooms as much of it as is in.
  // Where it is activated it shows as bright as its activations reveal it (as much as it is
  // activated), its reveal lights' not adding: elsewhere as all of them reveal it.
  const activeBloom = float(0).toVar();
  if (body) {
    If(u.int('uActivationCount').greaterThan(0), () => {
      If(gridValue.lessThan(0), () => {
        gridValue.assign(channelOf(texel('emissive', L1), L1.channel).x);
      });
      const fill = PLATE_LOOK.fill;
      const edge = fill + PLATE_LOOK.line + PLATE_LOOK.glow;
      const line = clamp(gridValue.sub(fill).div(edge - fill), 0, 1);
      const share = mix(float(ACTIVATED_PLATES), float(1), line).toVar();
      const into = active.mul(share).toVar();
      const brighter = activeGlow.div(max(active, 1e-4)).toVar();
      const colour = u.vec3('uActiveColor').mul(L0.bright).mul(brighter.add(1));
      diffuse.assign(vec4(mix(diffuse.rgb, colour, into), diffuse.a));
      activeBloom.assign(brighter.mul(into));
      If(revealed, () => {
        reveal.assign(mix(reveal, max(activeReveal, 0), active));
      });
    });
  }

  // The tints: the material's own, then its body's (or the sky's), in one run (`tints` then
  // `bodyTints` in the draw's table), each over what the ones before it left. Each is on where its
  // mask says: a channel of one of the material's layers as read (its masks as they cut it), or
  // how far the surface turns from the eye; those of a stage over `c`, and over `glow` too where
  // given (the glow, where it is added).
  const mask0 = maskLayer('mask0', L2);
  const mask1 = maskLayer('mask1', L3);
  const tintCount = u.int('uTintCount');
  const tintRow = (i: Node<'int'>, r: number) =>
    u.row('tints', select(i.lessThan(tintCount), i, i.sub(tintCount).add(MAX_TINTS)), r);
  /** Where a tint is on, by its mask (`d`, `e`: its rows 3 and 4). */
  const maskOn = (d: Node<'vec4'>, e: Node<'vec4'>) => {
    const by = int(d.x).toVar();
    const on = float(1).toVar();
    If(by.equal(1), () => {
      const layer = int(d.y).toVar();
      const v = vec4(select(layer.equal(2), mask0, mask1)).toVar();
      If(layer.equal(0), () => {
        v.assign(diffuse);
      }).ElseIf(layer.equal(1), () => {
        v.assign(emissive);
      });
      on.assign(channelOn(v, int(d.z)));
    }).ElseIf(by.equal(2), () => {
      const edge = clamp(dot(n, toEye), 0, 1).oneMinus();
      on.assign(smoothstep(e.x, max(e.y, e.x.add(1e-4)), edge));
    });
    return on;
  };
  const tintsOver = (stage: number, ...colours: Node<'vec3'>[]) =>
    tintRun(tintCount.add(u.int('uBodyTintCount')), tintRow, stage, maskOn, colours);
  // The surface as the tints before lighting leave it.
  const surface = diffuse.rgb.toVar();
  tintsOver(1, surface);

  // Unshaded: its surface; lit: by the light on it, and the shine; then darkened by its shades.
  const base = vec3(0).toVar();
  If(u.int('uUnshaded').equal(1), () => {
    base.assign(surface);
  });
  if (body) {
    If(u.int('uUnshaded').equal(0).and(u.int('uLit').equal(1)), () => {
      base.assign(surface.mul(light).add(shine.mul(specMap)).mul(u.float('uLightScale', 1)));
    });
    base.mulAssign(dark);
  }

  // The glow: a grid's Glow up to 1 dims its look, past 1 only blooms (past), revealing nothing
  // more. The emissive pattern cut: what is below the cut goes black, the rest keeps its range. (A
  // grid's activation's glow is in its active colour: see `activeBloom`.)
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
  const emissiveBlend = u.int('uEmissiveBlend', 2);
  const added = emissiveBlend.equal(2).toVar();
  const rgb = base.add(glow).toVar();
  If(added.not(), () => {
    rgb.assign(base.mul(glow).mul(select(emissiveBlend.equal(1), 2, 1)));
  });
  // The tints after lighting, over the colour, and over the glow where it is added.
  const tintedGlow = glow.toVar();
  If(added, () => {
    tintsOver(0, rgb, tintedGlow);
  }).Else(() => {
    tintsOver(0, rgb);
  });
  // A grid as bright as its lights reveal it (see `reveal`).
  if (body) {
    If(revealed, () => {
      rgb.assign(rgb.mul(reveal));
    });
  }

  const alpha = mask0.mul(mask1).mul(diffuse.a).toVar();
  If(u.int('uVertexAlpha').equal(1), () => {
    alpha.mulAssign(s.color.a);
  });
  // (Add blends by its colour alone: whatever its alpha, all of its light is added.)
  If(u.int('uAddsByColour').equal(1), () => {
    alpha.assign(1);
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
      .add(shineOut.mul(max(boost.sub(1), 0).add(activeBloom).add(past)).mul(covered)),
    colour.a,
  ).toVar();
  return { colour, glow: glowOut, cut };
}
