import { type Node, NodeMaterial, type Texture } from 'three/webgpu';
import {
  abs,
  attribute,
  bool,
  clamp,
  Discard,
  dot,
  float,
  Fn,
  fwidth,
  If,
  length,
  Loop,
  max,
  mix,
  mod,
  normalize,
  positionGeometry,
  pow,
  select,
  smoothstep,
  sqrt,
  textureLoad,
  transpose,
  varying,
  vec2,
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
 * A light's outline on its body's sphere, as the body's shader lights it (`reachOf`): where it
 * stops reaching (`uMainAt`: from a side or a point, how squarely the point faces it, its wrap
 * taken in; a spot, its cone's edge; above and below, where its two colours meet; the sky round
 * the body and the rim, where they reach half), and fainter where it reaches half (`uFaintAt`: from
 * a side; a point, by how far away; a spot, where its cone starts to fade) and how far a spot
 * reaches (half as strong); none where the frame has something nearer, nor behind another body's
 * sphere.
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
  const mainAt = u.float('uMainAt');
  const faintAt = u.float('uFaintAt', 9);
  // (A rim's turn of the view, as the rows of its matrix: see `viewTurn`.)
  const rimTurn = u.mat3('uRimTurn');
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
    const reach = float(1).toVar();
    If(kind.equal(0).or(kind.equal(3)), () => {
      const facing = dot(n, normalize(dir).negate()).toVar();
      main.assign(facing.sub(mainAt));
      faint.assign(facing.sub(faintAt));
    })
      .ElseIf(kind.equal(1), () => {
        const to = pos.sub(n).toVar();
        main.assign(dot(n, normalize(to)).sub(mainAt));
        faint.assign(length(to).sub(fade));
      })
      .ElseIf(kind.equal(2), () => {
        const away = pos.sub(n).toVar();
        const to = normalize(away).toVar();
        gone.assign(gone.or(dot(n, to).lessThanEqual(mainAt)));
        const along = dot(to.negate(), aim).toVar();
        main.assign(along.sub(cosCone));
        faint.assign(along.sub(cosFade));
        reach.assign(length(away).sub(fade));
      })
      .ElseIf(kind.equal(5), () => {
        // (The rim: by how far the point turns from the eye, the view leaned by its turn.)
        const view = transpose(rimTurn).mul(normalize(eye.sub(hit)));
        main.assign(dot(normalize(hit.sub(centre)), normalize(view)).sub(mainAt));
      })
      .Else(() => {
        const look = transpose(lightAxes).mul(eye.sub(centre));
        main.assign(dot(n, normalize(look)).sub(mainAt));
      });
    const a = max(line(main), max(line(faint), line(reach)).mul(0.45))
      .mul(alpha)
      .toVar();
    If(gone.or(a.lessThanEqual(0)), () => {
      Discard();
    });
    return cold(vec4(colour.mul(a), a));
  })();
  coldVertex(m);
  return m;
}

/** Whether a point of the scene is behind what the picture has drawn, or behind one of the bodies' spheres. */
function behindPicture(
  u: ShaderUniforms,
  frameDepth: Texture,
  viewProjection: Node<'mat4'>,
  at: Node<'vec3'>,
): Node<'bool'> {
  const clip = viewProjection.mul(vec4(at, 1)).toVar();
  const depth = clip.z.div(clip.w).mul(0.5).add(0.5);
  const eye = u.vec3('uEye');
  const ray = at.sub(eye).toVar();
  const far = length(ray).toVar();
  const d = ray.div(far).toVar();
  const hidden = depth.greaterThan(textureLoad(frameDepth, pixel()).x.add(2e-4)).toVar();
  const count = u.int('uSphereCount');
  Loop(MAX_BEAM_SPHERES, ({ i }) => {
    If(i.lessThan(count), () => {
      const near = meets(eye, u.row('surfaces', i, 0), d);
      If(near.greaterThan(0).and(near.lessThan(far.mul(0.999))), () => {
        hidden.assign(bool(true));
      });
    });
  });
  return hidden;
}

/** A point of the scene moved across the screen by `pixels` (x right, y up), in clip space. */
const shifted = (clip: Node<'vec4'>, pixels: Node<'vec2'>, viewport: Node<'vec2'>) =>
  vec4(clip.xy.add(pixels.mul(2).div(viewport).mul(clip.w)), clip.zw);

/**
 * The markers' lines, one instance each (`lineFrom`: its start and thickness in pixels; `lineTo`:
 * its end and whether dashed; `lineColour`): a strip along it on the screen, as thick wherever it
 * is, dashed 4 pixels on, 3 off; hidden where the picture is nearer, or behind a body.
 */
export function lineMaterial(u: ShaderUniforms, frameDepth: Texture, toClip: ToClip): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'aid-line';
  setBlend(m, 'over');
  const viewProjection = u.mat4('uViewProjection');
  const viewport = u.vec2('uViewport');
  const from = attribute<'vec4'>('lineFrom', 'vec4');
  const to = attribute<'vec4'>('lineTo', 'vec4');
  const colourIn = attribute<'vec4'>('lineColour', 'vec4');
  const corner = positionGeometry.xy;
  const half = from.w.div(2).add(1);
  const a = viewProjection.mul(vec4(from.xyz, 1));
  const b = viewProjection.mul(vec4(to.xyz, 1));
  const sa = a.xy.div(a.w).mul(viewport).mul(0.5);
  const sb = b.xy.div(b.w).mul(viewport).mul(0.5);
  const run = sb.sub(sa);
  const dir = run.div(max(length(run), 1e-6));
  const vAt = varying(mix(from.xyz, to.xyz, corner.x));
  // Its way along and across it in pixels, as the screen has them, not bent by depth: each
  // carried times its clip w, with w, and divided again (WebGL 2 has no unperspective varyings).
  const w = mix(a.w, b.w, corner.x);
  const vPixels = varying(vec3(corner.x.mul(length(run)), corner.y.mul(half), 1).mul(w));
  m.vertexNode = Fn(() =>
    toClip(
      shifted(mix(a, b, corner.x), vec2(dir.y.negate(), dir.x).mul(corner.y.mul(half)), viewport),
    ),
  )();
  const vColour = varying(colourIn);
  const vStyle = varying(vec2(from.w, to.w));
  m.fragmentNode = Fn(() => {
    If(behindPicture(u, frameDepth, viewProjection, vAt), () => {
      Discard();
    });
    const onScreen = vPixels.xy.div(vPixels.z).toVar();
    const edge = clamp(vStyle.x.div(2).add(0.5).sub(abs(onScreen.y)), 0, 1);
    const along = mod(onScreen.x, 7);
    const dash = select(
      vStyle.y.greaterThan(0.5),
      clamp(float(4.5).sub(along), 0, 1).mul(clamp(along.add(0.5), 0, 1)),
      float(1),
    );
    const alpha = vColour.a.mul(edge).mul(dash).mul(u.float('uFade', 1)).toVar();
    If(alpha.lessThanEqual(0), () => {
      Discard();
    });
    return cold(vec4(vColour.rgb.mul(alpha), alpha));
  })();
  coldVertex(m);
  return m;
}

/** How strongly a dot shows where the picture is nearer (behind a planet). */
const FAINT_DOT = 0.3;

/**
 * The markers' dots, one instance each (`dotAt`: where, and how far toward the eye; `dotSize`:
 * its width and shift across in pixels, its ring's width, whether on top; `dotColour`): a dark
 * disc in a ring of its colour, facing the screen, as wide at any distance; faint where the
 * picture is nearer, unless on top.
 */
export function dotMaterial(u: ShaderUniforms, frameDepth: Texture, toClip: ToClip): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'aid-dot';
  setBlend(m, 'over');
  const viewProjection = u.mat4('uViewProjection');
  const viewport = u.vec2('uViewport');
  const eye = u.vec3('uEye');
  const atIn = attribute<'vec4'>('dotAt', 'vec4');
  const size = attribute<'vec4'>('dotSize', 'vec4');
  const colourIn = attribute<'vec4'>('dotColour', 'vec4');
  const corner = positionGeometry.xy;
  const half = size.x.div(2).add(1);
  // (On its sphere's near side: a little past it, so its own sphere doesn't hide it.)
  const at = atIn.xyz.add(normalize(eye.sub(atIn.xyz)).mul(atIn.w.mul(1.002)));
  const vAt = varying(at);
  const vOffset = varying(corner.mul(half));
  m.vertexNode = Fn(() =>
    toClip(
      shifted(viewProjection.mul(vec4(at, 1)), corner.mul(half).add(vec2(size.y, 0)), viewport),
    ),
  )();
  const vColour = varying(colourIn);
  const vSize = varying(vec3(size.x, size.z, size.w));
  m.fragmentNode = Fn(() => {
    const r = length(vOffset);
    const outer = vSize.x.div(2);
    const disc = clamp(outer.add(0.5).sub(r), 0, 1);
    const ring = clamp(r.sub(outer.sub(vSize.y)).add(0.5), 0, 1).mul(disc);
    const faint = select(
      vSize.z.greaterThan(0.5).or(behindPicture(u, frameDepth, viewProjection, vAt).not()),
      float(1),
      float(FAINT_DOT),
    );
    const strength = vColour.a.mul(faint).mul(u.float('uFade', 1)).toVar();
    // The disc dark (as a marker's round is), its ring in its colour; premultiplied.
    const alpha = mix(disc.mul(0.65), disc, ring).mul(strength).toVar();
    If(alpha.lessThanEqual(0), () => {
      Discard();
    });
    return cold(vec4(vColour.rgb.mul(ring).mul(strength), alpha));
  })();
  coldVertex(m);
  return m;
}
