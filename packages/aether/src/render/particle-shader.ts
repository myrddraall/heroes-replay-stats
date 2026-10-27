import { NodeMaterial, type Texture } from 'three/webgpu';
import {
  attribute,
  Fn,
  mix,
  positionGeometry,
  select,
  texture,
  varying,
  vec3,
  vec4,
} from 'three/tsl';
import { tintBy } from './materials/blend-shader';
import type { ShaderUniforms } from './uniforms/shader-uniforms';
import { cold, coldVertex } from './cold-shaders';
import { type ToClip, setBlend } from './passes/pass-shaders';

/**
 * The particles: each a square facing the camera, streaked
 * as the view sweeps; light added, hidden behind what is opaque at its depth.
 */
export function particleMaterial(
  u: ShaderUniforms,
  tex: Texture,
  toClip: ToClip,
  depthTest: boolean,
): NodeMaterial {
  const m = new NodeMaterial();
  m.name = 'particle';
  setBlend(m, 'add');
  m.depthTest = depthTest;
  m.depthWrite = false;
  const STREAK_LENGTH = 14;
  const streak = u.float('uStreak');
  const particle = attribute<'vec4'>('particle', 'vec4');
  const colourIn = attribute<'vec4'>('particleColor', 'vec4');
  const corner = positionGeometry.xy;
  m.vertexNode = Fn(() => {
    const at = u.mat4('uView').mul(vec4(particle.xyz, 1)).toVar();
    const moved = vec4(
      at.x.add(corner.x.mul(particle.w).mul(streak.mul(STREAK_LENGTH).add(1))),
      at.y.add(corner.y.mul(particle.w).mul(mix(1, 0.3, streak))),
      at.z,
      at.w,
    );
    return toClip(u.mat4('uProjection').mul(moved));
  })();
  const vUv = varying(corner.add(0.5));
  const vColor = varying(vec4(colourIn.rgb, colourIn.a.mul(mix(1, 0.55, streak))));
  m.fragmentNode = Fn(() => {
    const tt = texture(tex, vUv).toVar();
    const ch = u.int('uChannel');
    const one = select(
      ch.equal(2),
      tt.a,
      select(ch.equal(3), tt.r, select(ch.equal(4), tt.g, tt.b)),
    );
    const c = select(ch.lessThanEqual(1), tt.rgb, vec3(one));
    const star = tintBy(
      c.mul(u.float('uBright')).mul(vColor.rgb),
      u.vec3('uBodyTintColor'),
      u.int('uBodyTintBlend'),
      u.float('uBodyTintStrength'),
    );
    return cold(vec4(star.mul(vColor.a), 0));
  })();
  coldVertex(m);
  return m;
}
