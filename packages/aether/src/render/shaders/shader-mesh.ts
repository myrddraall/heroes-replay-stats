import type { Node } from 'three/webgpu';
import {
  atan,
  attribute,
  clamp,
  dFdx,
  dFdy,
  Discard,
  dot,
  float,
  Fn,
  fwidth,
  If,
  max,
  min,
  normalize,
  positionGeometry,
  sqrt,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { shadeMaterial, type TextureSlots, uvChange } from './shader-material';
import type { ToClip } from './shader-passes';
import type { ShaderUniforms } from './shader-uniforms';
import { cold } from './cold-shaders';

/**
 * One of the sky's meshes drawn in three.js's shading language, shaded as its material says; a mesh that is a tube (`uTube`: the sky's star
 * cylinder) drawn as the exact tube. One shader for every sky mesh. Its depth is the rasterizer's,
 * put in WebGL's range on both APIs (`toClip`).
 */
export function meshNodes(
  u: ShaderUniforms,
  textures: TextureSlots,
  toClip: ToClip,
): { vertex: Node<'vec4'>; fragment: Node<'vec4'> } {
  const viewProjection = u.mat4('uViewProjection');
  const vertex = Fn(() => toClip(viewProjection.mul(vec4(positionGeometry, 1))))();
  const iUv = varying(attribute<'vec2'>('uv', 'vec2'));
  const iUv2 = varying(attribute<'vec2'>('uv1', 'vec2'));
  const iNormal = varying(attribute<'vec3'>('normal', 'vec3'));
  const iWorld = varying(positionGeometry);
  const iColor = varying(attribute<'vec4'>('color', 'vec4'));
  const eye = u.vec3('uEye');

  const fragment = Fn(() => {
    const uv = iUv.toVar();
    const uv2 = iUv2.toVar();
    const normal = iNormal.toVar();
    const world = iWorld.toVar();
    const coverage = float(1).toVar();
    // A tube: where the line from the eye through the mesh meets it, its texture round and up it.
    const shape = u.vec4('uTubeShape');
    const span = u.vec2('uTubeSpan');
    const map = u.vec4('uTubeMap');
    const d = normalize(iWorld.sub(eye)).toVar();
    const o = eye.xy.sub(shape.xy).toVar();
    const a = dot(d.xy, d.xy).toVar();
    const b = dot(o, d.xy).toVar();
    const c = dot(o, o).sub(shape.z.mul(shape.z)).toVar();
    const t = b.negate().add(sqrt(max(b.mul(b).sub(a.mul(c)), 0))).div(max(a, 1e-9)).toVar();
    const at = eye.add(d.mul(t)).toVar();
    // Cut off at its ends, smoothed over a pixel (its cover reaches past them; worked out for every
    // pixel, as a derivative needs, used only for a tube).
    const inside = min(at.z.sub(span.x), span.y.sub(at.z)).toVar();
    const edge = clamp(inside.div(max(fwidth(inside), 1e-6)).add(0.5), 0, 1).toVar();
    If(u.int('uTube').equal(1), () => {
      const round = at.xy.sub(shape.xy).toVar();
      const turn = atan(round.y, round.x).div(2 * Math.PI);
      uv.assign(vec2(map.x.mul(turn).add(map.y), map.z.mul(at.z).add(map.w)));
      normal.assign(vec3(normalize(round), 0).negate());
      world.assign(at);
      coverage.assign(edge);
    });
    const change = uvChange(uv, uv2, dFdx, dFdy);
    const shaded = shadeMaterial(
      u,
      textures,
      'mesh',
      { uv, uv2, normal, world, color: iColor, coverage, pastOutline: vec2(0).x.greaterThan(1).toVar() },
      change,
    );
    If(shaded.cut, () => {
      Discard();
    });
    // (A variable, not a select of them: three.js can't type a select of variables a function returns.)
    const result = shaded.colour.toVar();
    If(u.int('uOutput').equal(1), () => {
      result.assign(shaded.glow);
    });
    return cold(result);
  })();
  return { vertex, fragment };
}
