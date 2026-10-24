import type { Node } from 'three/webgpu';
import {
  abs,
  acos,
  atan,
  clamp,
  cross,
  depth,
  Discard,
  dFdx,
  dFdy,
  dot,
  float,
  floor,
  fract,
  Fn,
  fwidth,
  If,
  int,
  length,
  Loop,
  max,
  min,
  mix,
  mod,
  normalize,
  positionGeometry,
  select,
  sqrt,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { V_SAMPLES } from '../scene-limits';
import { shadeMaterial, type Surface, type TextureSlots, uvChange } from './shader-material';
import type { ShaderUniforms } from './shader-uniforms';
import { cold } from './cold-shaders';

/**
 * A planet's body part drawn in three.js's shading language: on a square facing the eye, its shape
 * found under each pixel and shaded as the material says. One shader for every part: its shape (`uShape`: a sphere's near side 0 or far side 1, a ring
 * 2, a frustum's near wall 3 or far wall 4, a disc 5, a plane 6, a capsule's outside 7 or inside 8)
 * is a branch on its uniforms. The shape is found once, for both the colour and the depth (written
 * as the colour is worked out); see `shader-material.ts` for how it is kept small.
 */

const RING_SAMPLES = 4;
const PI = Math.PI;

/** The body shader's parts: its square's place (vertex), and its colour or glow (by `uOutput`), its depth written with it. */
export interface BodyNodes {
  readonly vertex: Node<'vec4'>;
  readonly fragment: Node<'vec4'>;
}

/**
 * A body's draw as a shader: `toClip` turns a clip-space position into the API's (its depth's
 * range: WebGPU's 0 to w, WebGL's -w to w), and every depth written is WebGL's, 0 to 1, so
 * depths read back compare alike on both.
 */
export function bodyNodes(
  u: ShaderUniforms,
  textures: TextureSlots,
  toClip: (clip: Node<'vec4'>) => Node<'vec4'>,
): BodyNodes {
  const viewProjection = u.mat4('uViewProjection');
  const centre = u.vec3('uCentre');
  const axes = u.mat3('uAxes');
  const radius = u.float('uRadius', 1);
  const extent = u.float('uExtent', 1);
  const quad = positionGeometry.xy.mul(extent);
  const vQuad = varying(quad);
  const vertex = Fn(() => {
    const world = centre.add(axes.mul(vec3(quad.x, 0, quad.y)));
    return toClip(viewProjection.mul(vec4(world, 1)));
  })();

  const eye = u.vec3('uEye');
  const uShape = u.int('uShape');
  const params = u.vec3('uShapeParams');
  const shapeCentre = u.vec3('uShapeCentre');
  const axis = u.vec3('uShapeAxis');
  const shapeUp = u.vec3('uShapeUp');
  const span = u.vec4('uShapeSpan');

  /** Where the eye's ray meets the part: p (its frame), n, how far across a ring, coverage, depth. */
  const hit = () => {
    const d = normalize(vec3(vQuad.x, 0, vQuad.y).div(radius).sub(eye)).toVar();
    const p = vec3(0).toVar();
    const n = vec3(0, 0, 1).toVar();
    const across = float(0).toVar();
    const coverage = float(1).toVar();
    const pastOutline = vec2(0).x.greaterThan(1).toVar(); // false
    const missedRay = vec2(0).x.greaterThan(1).toVar(); // false: t <= 0
    const world = vec3(0).toVar();
    If(uShape.lessThan(3), () => {
      // A sphere (near side 0, far side 1) or a ring (2): each one's edge smoothed over a pixel,
      // how far inside it the pixel is over how much that changes across the pixel (worked out
      // for every pixel of the square, before any is dropped).
      const sphere = uShape.lessThan(2).toVar();
      const r = params.x;
      const from = eye.sub(shapeCentre).toVar();
      const b = dot(from, d).toVar();
      const disc = b.mul(b).sub(dot(from, from)).add(r.mul(r)).toVar();
      const tRing = params.z.sub(eye.y).div(d.y).toVar();
      const rr = length(eye.add(d.mul(tRing)).xz).toVar();
      const inside = select(sphere, disc, min(rr.sub(params.x), params.y.sub(rr))).toVar();
      coverage.assign(clamp(inside.div(max(fwidth(inside), 1e-6)).add(0.5), 0, 1));
      If(sphere, () => {
        pastOutline.assign(disc.lessThan(0));
        const root = sqrt(max(disc, 0)).toVar();
        const near = uShape.equal(0).toVar();
        const t = select(near, b.negate().sub(root), b.negate().add(root)).toVar();
        missedRay.assign(t.lessThanEqual(0));
        p.assign(from.add(d.mul(t)));
        n.assign(p.div(r).mul(select(near, 1, -1)));
      }).Else(() => {
        missedRay.assign(tRing.lessThanEqual(0));
        p.assign(eye.add(d.mul(tRing)));
        n.assign(vec3(0, -1, 0));
        across.assign(length(p.xz).sub(params.x).div(max(1e-5, params.y.sub(params.x))));
      });
      world.assign(p);
    }).Else(() => {
      const edges = vec3(1).toVar();
      const t = float(-1).toVar();
      const capsuleNormal = vec3(0, 0, 1).toVar();
      If(uShape.lessThanEqual(4), () => {
        // A frustum: a tube, a cone (its nearer wall 3, or its farther 4: its inside).
        const o = eye.sub(shapeCentre).toVar();
        const oh = dot(o, axis).toVar();
        const dh = dot(d, axis).toVar();
        const oP = o.sub(axis.mul(oh)).toVar();
        const dP = d.sub(axis.mul(dh)).toVar();
        const m = span.y.sub(span.x).div(max(span.w.sub(span.z), 1e-6)).toVar();
        const ro = m.mul(oh.sub(span.z)).add(span.x).toVar();
        const a = dot(dP, dP).sub(m.mul(m).mul(dh).mul(dh)).toVar();
        const bb = dot(oP, dP).sub(m.mul(dh).mul(ro)).toVar();
        const disc = bb.mul(bb).sub(a.mul(dot(oP, oP).sub(ro.mul(ro)))).toVar();
        const sq = sqrt(max(disc, 0)).toVar();
        const t1 = bb.negate().sub(sq).div(a).toVar();
        const t2 = bb.negate().add(sq).div(a).toVar();
        t.assign(select(uShape.equal(4), max(t1, t2), min(t1, t2)));
        const h = oh.add(t.mul(dh)).toVar();
        edges.assign(vec3(disc, h.sub(span.z), span.w.sub(h)));
      })
        .ElseIf(uShape.equal(5), () => {
          // A disc.
          t.assign(dot(shapeCentre.sub(eye), axis).div(dot(d, axis)));
          const q = eye.add(d.mul(t)).sub(shapeCentre).toVar();
          const r = length(q.sub(axis.mul(dot(q, axis)))).toVar();
          edges.assign(vec3(1, r.sub(span.x), span.y.sub(r)));
        })
        .ElseIf(uShape.equal(6), () => {
          // A plane.
          const rightOf = cross(shapeUp, axis).toVar();
          t.assign(dot(shapeCentre.sub(eye), axis).div(dot(d, axis)));
          const q = eye.add(d.mul(t)).sub(shapeCentre).toVar();
          edges.assign(vec3(1, span.x.mul(0.5).sub(abs(dot(q, rightOf))), span.y.mul(0.5).sub(abs(dot(q, shapeUp)))));
        })
        .Else(() => {
          // A capsule: a tube closed by half spheres; its six crossings in one loop, the tube's two,
          // then its low end's, then its high end's, the nearer of each two first (the first of
          // equal crossings is kept).
          const far = uShape.equal(8).toVar();
          const r = span.x;
          const o = eye.sub(shapeCentre).toVar();
          const a0 = axis.mul(span.z).toVar();
          const a1 = axis.mul(span.w).toVar();
          const seg = a1.sub(a0).toVar();
          const w0 = o.sub(a0).toVar();
          const b = dot(d, seg).toVar();
          const c = dot(seg, seg).toVar();
          const e = dot(seg, w0).toVar();
          const dd = dot(d, w0).toVar();
          const den = c.sub(b.mul(b)).toVar();
          const sAt = clamp(select(den.greaterThan(1e-9), e.sub(b.mul(dd)).div(den), 0), 0, 1).toVar();
          const onAxis = a0.add(seg.mul(sAt)).toVar();
          const nearAt = dot(onAxis.sub(o), d).toVar();
          edges.assign(vec3(r.sub(length(o.add(d.mul(nearAt)).sub(onAxis))), 1, 1));
          const best = select(far, float(-1), float(1e20)).toVar();
          const oh = dot(o, axis).toVar();
          const dh = dot(d, axis).toVar();
          const oP = o.sub(axis.mul(oh)).toVar();
          const dP = d.sub(axis.mul(dh)).toVar();
          const qa = dot(dP, dP).toVar();
          const qb = dot(oP, dP).toVar();
          const qc = dot(oP, oP).sub(r.mul(r)).toVar();
          const disc = qb.mul(qb).sub(qa.mul(qc)).toVar();
          const tubeMeets = disc.greaterThan(0).and(qa.greaterThan(1e-9)).toVar();
          // (A count from a uniform, not 6: a loop of a fixed length is unrolled.)
          const crossings = select(uShape.greaterThanEqual(7), int(6), int(0)).toVar();
          Loop(crossings, ({ i }) => {
            const sign = select(i.equal(0).or(i.equal(2)).or(i.equal(4)), float(-1), float(1)).toVar();
            const tk = float(0).toVar();
            const meets = vec2(0).x.greaterThan(1).toVar(); // false
            const normal = vec3(0, 0, 1).toVar();
            If(i.lessThan(2), () => {
              tk.assign(qb.negate().add(sign.mul(sqrt(max(disc, 0)))).div(qa));
              const h = oh.add(tk.mul(dh)).toVar();
              meets.assign(tubeMeets.and(tk.greaterThan(0)).and(h.greaterThanEqual(span.z)).and(h.lessThanEqual(span.w)));
              const q = o.add(d.mul(tk)).toVar();
              normal.assign(normalize(q.sub(axis.mul(dot(q, axis)))));
            }).Else(() => {
              const first = i.lessThan(4).toVar();
              const oc = o.sub(select(first, a0, a1)).toVar();
              const cb = dot(oc, d).toVar();
              const cd = cb.mul(cb).sub(dot(oc, oc).sub(r.mul(r))).toVar();
              tk.assign(cb.negate().add(sign.mul(sqrt(max(cd, 0)))));
              const h = dot(o.add(d.mul(tk)), axis).toVar();
              const beyond = select(first, h.lessThanEqual(span.z), h.greaterThanEqual(span.w));
              meets.assign(cd.greaterThan(0).and(tk.greaterThan(0)).and(beyond));
              normal.assign(oc.add(d.mul(tk)).div(r));
            });
            If(meets.and(select(far, tk.greaterThan(best), tk.lessThan(best))), () => {
              best.assign(tk);
              capsuleNormal.assign(normal);
            });
          });
          t.assign(select(best.greaterThan(0).and(best.lessThan(1e19)), best, float(-1)));
        });
      const cover = clamp(edges.div(max(fwidth(edges), vec3(1e-6))).add(0.5), 0, 1).toVar();
      // How much of the point is seen past the bodies' surfaces, to as many as there are: none where
      // one is between it and the eye (its edge smoothed over a pixel), or it is inside one. (A
      // pixel's size is taken before the loop: derivatives in it aren't to be relied on.)
      const at = eye.add(d.mul(abs(t))).toVar();
      const from = centre.add(axes.mul(eye.mul(radius))).toVar();
      const ray = centre.add(axes.mul(at.mul(radius))).sub(from).toVar();
      const farOf = max(length(ray), 1e-6).toVar();
      const dir = ray.div(farOf).toVar();
      const pixel = max(length(fwidth(dir)), 1e-7).toVar();
      const seen = float(1).toVar();
      Loop(u.int('uSurfaceCount'), ({ i }) => {
        const sf = u.row('surfaces', i, 0).toVar();
        const to = sf.xyz.sub(from).toVar();
        const along = dot(to, dir).toVar();
        const edge = select(
          along.lessThan(farOf),
          length(to.sub(dir.mul(along))).sub(sf.w).div(pixel.mul(max(along, 1e-6))),
          length(to.sub(ray)).sub(sf.w).div(pixel.mul(farOf)),
        );
        seen.mulAssign(clamp(edge.add(0.5), 0, 1));
      });
      coverage.assign(min(cover.x, min(cover.y, cover.z)).mul(seen));
      missedRay.assign(t.lessThanEqual(0));
      p.assign(eye.add(d.mul(t)).sub(shapeCentre));
      If(uShape.equal(5).or(uShape.equal(6)), () => {
        n.assign(select(dot(d, axis).lessThan(0), axis, axis.negate()));
      })
        .ElseIf(uShape.greaterThanEqual(7), () => {
          n.assign(select(uShape.equal(7), capsuleNormal, capsuleNormal.negate()));
        })
        .Else(() => {
          const m = span.y.sub(span.x).div(max(span.w.sub(span.z), 1e-6));
          const out = normalize(normalize(p.sub(axis.mul(dot(p, axis)))).sub(axis.mul(m))).toVar();
          n.assign(select(uShape.equal(3), out, out.negate()));
        });
      world.assign(p.add(shapeCentre));
    });
    // (A ring's point is in the body's frame already, found from the eye itself; every other
    // shape's is about the shape's centre.)
    const at = select(uShape.equal(2), p, p.add(shapeCentre)).toVar();
    const clip = viewProjection.mul(vec4(centre.add(axes.mul(at.mul(radius))), 1)).toVar();
    const depthOf = clip.z.div(clip.w).mul(0.5).add(0.5).toVar();
    return { p, n, across, coverage, pastOutline, missedRay, world, depthOf };
  };

  /** A ring mapping's v: nothing at both edges, all at the circle mid of the way across (as the mesh has it). */
  const ringV = (midAt: Node<'float'>, acrossAt: Node<'float'>) => {
    const mid = clamp(midAt, 0.001, 0.999).toVar();
    return select(acrossAt.lessThan(mid), acrossAt.div(mid), acrossAt.oneMinus().div(mid.oneMinus()));
  };
  /** A mapping's kind, if it is a ring's (the one that reads how far across the ring). */
  const ringMapping = (kind: Node<'int'>) => kind.notEqual(0).and(kind.notEqual(1)).and(kind.notEqual(3));
  /** A point's texture coordinates by mapping m (0: uMap, 1: uMap2) (`mapped`), its v table the vTable's column. */
  const mapped = (m: Node<'int'>, p: Node<'vec3'>, acrossAt: Node<'float'>) => {
    const second = m.equal(1).toVar();
    const kind = select(second, u.int('uMap2.kind'), u.int('uMap.kind')).toVar();
    const pole = select(second, u.vec3('uMap2.pole'), u.vec3('uMap.pole')).toVar();
    const meridian = select(second, u.vec3('uMap2.meridian'), u.vec3('uMap.meridian')).toVar();
    const a = select(second, u.vec4('uMap2.a'), u.vec4('uMap.a')).toVar();
    const b = select(second, u.vec4('uMap2.b'), u.vec4('uMap.b')).toVar();
    const uv = vec2(0).toVar();
    If(kind.equal(0), () => {
      const un = normalize(p).toVar();
      const polar = acos(clamp(dot(un, pole), -1, 1));
      const az = atan(dot(un, cross(pole, meridian)), dot(un, meridian)).div(2 * PI).toVar();
      const at = clamp(polar.div(PI), 0, 1).mul(V_SAMPLES - 1).toVar();
      // (At the far pole, k is the last but one and the mix all the way: the last value.)
      const kf = min(floor(at), V_SAMPLES - 2).toVar();
      const low = u.row('vTable', int(kf), 0).toVar();
      const high = u.row('vTable', int(kf.add(1)), 0).toVar();
      const v = mix(select(second, low.y, low.x), select(second, high.y, high.x), at.sub(kf));
      uv.assign(vec2(fract(a.y.add(select(a.x.greaterThan(0.5), az.negate(), az))), v));
    })
      .ElseIf(kind.equal(1), () => {
        const p4 = vec4(p, 1).toVar();
        uv.assign(vec2(dot(a, p4), dot(b, p4)));
      })
      .ElseIf(kind.equal(3), () => {
        // Round an axis: u by the angle from the meridian, v along the axis or out from it.
        const h = dot(p, pole).toVar();
        const r = p.sub(pole.mul(h)).toVar();
        const az = atan(dot(r, cross(pole, meridian)), dot(r, meridian)).div(2 * PI).toVar();
        const along = select(b.y.greaterThan(0.5), length(r), h);
        uv.assign(vec2(a.y.add(select(a.x.greaterThan(0.5), az.negate(), az).mul(b.x)), along.sub(a.z).div(a.w.sub(a.z))));
      })
      .Else(() => {
        const az = abs(mod(atan(p.z, p.x).sub(a.x).add(PI), 2 * PI).sub(PI)).toVar();
        uv.assign(vec2(a.y.mul(az.div(PI).oneMinus()), ringV(a.z, acrossAt)));
      });
    return uv;
  };

  const fragment = Fn(() => {
    const h = hit();
    // The depth (WebGL's, 0 to 1): the shape's where it covers the pixel, else nothing in front.
    // (`depth.assign` makes the write; it is put into the shader where it is added, as three.js's own is.)
    (depth.assign(select(h.coverage.greaterThan(0), h.depthOf, float(1))) as unknown as { toStack(): void }).toStack();
    // Both mappings, by the one `mapped` in a loop (uMaps: 2, a uniform: a loop of a fixed length
    // is unrolled), then the coordinates' change across the pixel (before the loop below).
    const uv = vec2(0).toVar();
    const uv2 = vec2(0).toVar();
    Loop(u.int('uMaps', 2), ({ i }) => {
      const at = mapped(i, h.p, h.across).toVar();
      If(i.equal(0), () => {
        uv.assign(at);
      }).Else(() => {
        uv2.assign(at);
      });
    });
    const change = uvChange(uv, uv2, dFdx, dFdy);
    const width = fwidth(h.across).toVar();
    // Shaded once; a ring, brightest along one circle (its v's peak: a crease a pixel or so wide
    // when small), at RING_SAMPLES points across the pixel's width of it, averaged, so the line is
    // as smooth as the game's drawn larger and scaled down, not a staircase. (One loop, as long as
    // the shape asks: the shading written out once in it.)
    const ring = uShape.equal(2).toVar();
    const samples = select(ring, int(RING_SAMPLES), int(1)).toVar();
    const output = u.int('uOutput');
    const colour = vec4(0).toVar();
    const glow = vec4(0).toVar();
    const cut = vec2(0).x.greaterThan(1).toVar(); // false
    const firstRing = ringMapping(u.int('uMap.kind')).toVar();
    const secondRing = ringMapping(u.int('uMap2.kind')).toVar();
    Loop(samples, ({ i }) => {
      const uvAt = uv.toVar();
      const uv2At = uv2.toVar();
      If(ring, () => {
        const a = clamp(h.across.add(width.mul(float(i).add(0.5).div(RING_SAMPLES).sub(0.5))), 0, 1).toVar();
        If(firstRing, () => {
          uvAt.assign(vec2(uvAt.x, ringV(u.vec4('uMap.a').z, a)));
        });
        If(secondRing, () => {
          uv2At.assign(vec2(uv2At.x, ringV(u.vec4('uMap2.a').z, a)));
        });
      });
      const surface: Surface = {
        uv: uvAt,
        uv2: uv2At,
        normal: h.n,
        world: h.world,
        color: u.vec4('uPartColor'),
        coverage: h.coverage,
        pastOutline: h.pastOutline,
      };
      const shaded = shadeMaterial(u, textures, 'body', surface, change);
      colour.addAssign(shaded.colour);
      glow.addAssign(shaded.glow);
      cut.assign(cut.or(shaded.cut));
    });
    colour.divAssign(float(samples));
    glow.divAssign(float(samples));
    If(h.missedRay.or(cut), () => {
      Discard();
    });
    const result = vec4(0).toVar();
    If(h.coverage.greaterThan(0), () => {
      result.assign(select(output.equal(1), glow, colour));
    });
    return cold(result);
  })();

  return { vertex, fragment };
}
