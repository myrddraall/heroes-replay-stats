import { type Node, NodeMaterial, type Texture } from 'three/webgpu';
import {
  abs,
  bool,
  Discard,
  dot,
  float,
  Fn,
  fwidth,
  If,
  length,
  Loop,
  max,
  normalize,
  positionGeometry,
  pow,
  select,
  smoothstep,
  sqrt,
  textureLoad,
  transpose,
  varying,
  vec3,
  vec4,
} from 'three/tsl';
import { MAX_BEAM_SPHERES } from '../uniforms/limits';
import type { ShaderUniforms } from '../uniforms/shader-uniforms';
import { cold, coldVertex } from '../cold-shaders';
import { type ToClip, overlay, pixel, setBlend } from '../passes/pass-shaders';

/** Where the line of sight from the eye along d meets a sphere first (none: -1). */
const meets = (eye: Node<'vec3'>, sphere: Node<'vec4'>, d: Node<'vec3'>) => {
  const oc = eye.sub(sphere.xyz).toVar();
  const b = dot(oc, d).toVar();
  const disc = b
    .mul(b)
    .sub(dot(oc, oc).sub(sphere.w.mul(sphere.w)))
    .toVar();
  return select(disc.greaterThan(0), b.negate().sub(sqrt(max(disc, 0))), float(-1)).toVar();
};

/**
 * A light's beam, over the picture as shown; hidden where the
 * frame's depth is nearer, behind or inside a body, and over its own body. `kind`: a light's (its
 * colour added), a darkening one's (taken away), or a darkening one's edges. A planet's axis is
 * drawn as a light's, not fading (`uFade` 0) and not hidden over its body (`uBody` none).
 */
export function beamMaterial(
  u: ShaderUniforms,
  frameDepth: Texture,
  kind: 'light' | 'dark' | 'edge',
  toClip: ToClip,
): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = `beam:${kind}`;
  setBlend(m, kind === 'dark' ? 'darken' : 'add');
  const viewProjection = u.mat4('uViewProjection');
  const tube = positionGeometry;
  const across = u.vec3('uAcross');
  const upOf = u.vec3('uUp');
  const normalOf = across.mul(tube.x).add(upOf.mul(tube.y));
  const atOf = u
    .vec3('uCentre')
    .add(normalOf.mul(u.float('uRadius')))
    .add(u.vec3('uWay').mul(tube.z).mul(u.float('uLength')));
  const vAt = varying(atOf);
  const vNormal = varying(normalOf);
  const vAlong = varying(tube.z);
  m.vertexNode = Fn(() => toClip(viewProjection.mul(vec4(atOf, 1))))();
  const eye = u.vec3('uEye');
  const body = u.vec4('uBody');
  const count = u.int('uSphereCount');
  const alpha = u.float('uAlpha');
  const colour = u.vec3('uColor');
  m.fragmentNode = Fn(() => {
    const clip = viewProjection.mul(vec4(vAt, 1)).toVar();
    const depth = clip.z.div(clip.w).mul(0.5).add(0.5);
    const ray = vAt.sub(eye).toVar();
    const far = length(ray).toVar();
    const d = ray.div(far).toVar();
    const hidden = depth
      .greaterThan(textureLoad(frameDepth, pixel()).x)
      .or(meets(eye, body, d).greaterThan(0))
      .toVar();
    Loop(MAX_BEAM_SPHERES, ({ i }) => {
      If(i.lessThan(count), () => {
        const near = meets(eye, u.row('surfaces', i, 0), d);
        If(near.greaterThan(0).and(near.lessThan(far)), () => {
          hidden.assign(bool(true));
        });
      });
    });
    If(hidden, () => {
      Discard();
    });
    const facing = abs(dot(normalize(vNormal), normalize(eye.sub(vAt))));
    const shape = kind === 'edge' ? pow(facing.oneMinus(), 8) : facing;
    // Fading as it goes (`uFade` 1: a light's beam), or as strong all along (0: a planet's axis).
    const a = alpha
      .mul(shape)
      .mul(vAlong.mul(u.float('uFade', 1)).oneMinus())
      .toVar();
    return cold(vec4(colour.mul(a), a));
  })();
  coldVertex(m);
  return m;
}

/**
 * A light's outline on its body's sphere: lines where its reach crosses its
 * edges; none where the frame has something nearer, nor behind another body's sphere.
 */
export function outlineMaterial(
  u: ShaderUniforms,
  frameDepth: Texture,
  toClip: ToClip,
): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'outline';
  setBlend(m, 'add');
  const viewProjection = u.mat4('uViewProjection');
  const centre = u.vec3('uCentre');
  const axes = u.mat3('uAxes');
  const extent = u.float('uExtent', 1);
  const atOf = centre.add(
    axes.mul(vec3(positionGeometry.x.mul(extent), 0, positionGeometry.y.mul(extent))),
  );
  const vAt = varying(atOf);
  m.vertexNode = Fn(() => toClip(viewProjection.mul(vec4(atOf, 1))))();
  const eye = u.vec3('uEye');
  const radius = u.float('uRadius', 1);
  // The body's placement frame, the light's (its square faces the eye: `uAxes`).
  const lightAxes = u.mat3('uLightAxes');
  const count = u.int('uSphereCount');
  const kind = u.int('uKind');
  const dir = u.vec3('uDir');
  const pos = u.vec3('uPos');
  const aim = u.vec3('uAim');
  const fade = u.float('uFade');
  const cosCone = u.float('uCosCone');
  const cosFade = u.float('uCosFade');
  const alpha = u.float('uAlpha');
  const colour = u.vec3('uColor');
  const line = (fv: Node<'float'>) =>
    smoothstep(0, 1.5, abs(fv).div(max(fwidth(fv), 1e-6))).oneMinus();
  m.fragmentNode = Fn(() => {
    const d = normalize(vAt.sub(eye)).toVar();
    const t = meets(eye, vec4(centre, radius), d);
    const gone = t.lessThanEqual(0).toVar();
    Loop(MAX_BEAM_SPHERES, ({ i }) => {
      If(i.lessThan(count), () => {
        const near = meets(eye, u.row('surfaces', i, 0), d);
        If(near.greaterThan(0).and(near.lessThan(t)), () => {
          gone.assign(bool(true));
        });
      });
    });
    const hit = eye.add(d.mul(t)).toVar();
    const clip = viewProjection.mul(vec4(hit, 1)).toVar();
    const depth = clip.z.div(clip.w).mul(0.5).add(0.5);
    gone.assign(gone.or(depth.greaterThan(textureLoad(frameDepth, pixel()).x.add(2e-4))));
    const n = normalize(transpose(lightAxes).mul(hit.sub(centre))).toVar();
    const main = float(1).toVar();
    const faint = float(1).toVar();
    If(kind.equal(0).or(kind.equal(3)), () => {
      main.assign(dot(n, normalize(dir).negate()));
    })
      .ElseIf(kind.equal(1), () => {
        const to = pos.sub(n).toVar();
        main.assign(dot(n, normalize(to)));
        faint.assign(length(to).sub(fade));
      })
      .ElseIf(kind.equal(2), () => {
        const to = normalize(pos.sub(n)).toVar();
        gone.assign(gone.or(dot(n, to).lessThanEqual(0)));
        const along = dot(to.negate(), aim).toVar();
        main.assign(along.sub(cosCone));
        faint.assign(along.sub(cosFade));
      })
      .Else(() => {
        const look = transpose(lightAxes).mul(eye.sub(centre));
        main.assign(float(0.5).sub(dot(n, normalize(look))));
      });
    const a = max(line(main), line(faint).mul(0.45)).mul(alpha).toVar();
    If(gone.or(a.lessThanEqual(0)), () => {
      Discard();
    });
    return cold(vec4(colour.mul(a), a));
  })();
  coldVertex(m);
  return m;
}
