import { type Node, NodeMaterial, type Texture } from 'three/webgpu';
import {
  abs,
  atan,
  attribute,
  bool,
  clamp,
  cross,
  Discard,
  dot,
  float,
  Fn,
  fract,
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
import { HALF_REACH } from '../../lights/lights';
import { seenFrom } from '../materials/material-shader';
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

/** How many dashes a dashed line has round a spot's aim. */
const DASHES = 48;
/** How far a line's value may change across a pixel and still be drawn (more: the sphere's outline). */
const MAX_STEP = 0.05;

/**
 * A light's outline on its body's sphere, as the body's shader lights it (`reachOf`), for every
 * kind alike: where it stops reaching (none past it), fainter where it is half as strong, and
 * dashed what it doesn't stop at. Where it stops: from a side or a point, how squarely the point
 * faces it, its wrap taken in (`uMainAt`); a spot, its cone's edge, its back cut the same; a point
 * or a spot, how far it reaches (its range); each of a point's or a spot's ends only where the
 * others let light through, so they make one outline round what it lights. Where it is half as
 * strong: from a side, its facing wrapped and sharpened by its softness (`uFaintAt`); a point,
 * that with how far away it is; a hemisphere, where its two colours meet; the sky round the body
 * and the rim, where they reach half (`uFaintAt`: they never stop). Dashed: where a spot's cone
 * starts to fade, as the lines round it are. All of it gone towards the sphere's outline, and
 * where the frame has something nearer, or behind another body's sphere.
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
  const wrap = u.float('uWrap');
  const softness = u.float('uSoftness', 1);
  const cosCone = u.float('uCosCone');
  const cosFade = u.float('uCosFade');
  const mainAt = u.float('uMainAt');
  const faintAt = u.float('uFaintAt', 9);
  // (A rim's turn of the view, as the rows of its matrix: see `viewTurn`.)
  const rimTurn = u.mat3('uRimTurn');
  const alpha = u.float('uAlpha');
  const colour = u.vec3('uColor');
  /** How strong a point or a spot is at a distance (as the body's shader has it): none at its range. */
  const falloff = (distance: Node<'float'>) => {
    const r2 = distance.mul(distance).div(fade.mul(fade));
    const ends = clamp(r2.mul(r2).oneMinus(), 0, 1);
    return ends.mul(ends).div(r2.div(HALF_REACH * HALF_REACH).add(1));
  };
  // (A pixel's step capped: at the sphere's outline its neighbours fall off it, their steps are
  // nothing to go by, and every value there would read as on a line.)
  const line = (fv: Node<'float'>) =>
    smoothstep(0, 1.5, abs(fv).div(clamp(fwidth(fv), 1e-6, MAX_STEP))).oneMinus();
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
    // (A dashed line: where it is, and whether this piece of it shows.)
    const dashed = float(1).toVar();
    const dash = float(1).toVar();
    // (Where each end shows: only where the other ends let light through, one outline round what it lights.)
    const mainOn = float(1).toVar();
    const reachOn = float(1).toVar();
    // (A spot's third end: where its body turns from it, within its cone and its reach.)
    const side = float(1).toVar();
    const sideOn = float(0).toVar();
    If(kind.equal(0).or(kind.equal(3)), () => {
      const facing = dot(n, normalize(dir).negate()).toVar();
      main.assign(facing.sub(mainAt));
      faint.assign(facing.sub(faintAt));
    })
      .ElseIf(kind.equal(1), () => {
        const away = pos.sub(n).toVar();
        const facing = dot(n, normalize(away)).toVar();
        main.assign(facing.sub(mainAt));
        reach.assign(length(away).sub(fade));
        mainOn.assign(select(length(away).lessThan(fade), float(1), float(0)));
        reachOn.assign(select(facing.greaterThan(mainAt), float(1), float(0)));
        const lit = pow(clamp(facing.add(wrap).div(wrap.add(1)), 0, 1), softness);
        faint.assign(lit.mul(falloff(length(away))).sub(0.5));
      })
      .ElseIf(kind.equal(2), () => {
        const away = pos.sub(n).toVar();
        const to = normalize(away).toVar();
        const facing = dot(n, to).toVar();
        // (Its cone as the body's shader tests it: at the edge it sees nearest, past its side.)
        const along = dot(normalize(pos.sub(seenFrom(pos, n))).negate(), aim).toVar();
        const inReach = length(away).lessThan(fade).toVar();
        const facesIt = facing.greaterThan(mainAt).toVar();
        const inCone = along.greaterThan(cosCone).toVar();
        main.assign(along.sub(cosCone));
        reach.assign(length(away).sub(fade));
        side.assign(facing.sub(mainAt));
        mainOn.assign(select(inReach.and(facesIt), float(1), float(0)));
        reachOn.assign(select(inCone.and(facesIt), float(1), float(0)));
        sideOn.assign(select(inCone.and(inReach), float(1), float(0)));
        // Where its cone starts to fade (its Edge in from its edge), dashed as the lines round it
        // are: pieces round its aim.
        // (Its value everywhere, shown only where it applies: a value set only there would jump
        // at its edge, and the jump read as a line.)
        dashed.assign(along.sub(cosFade));
        const across = normalize(
          cross(aim, select(abs(aim.z).lessThan(0.9), vec3(0, 0, 1), vec3(1, 0, 0))),
        );
        const round = atan(dot(to, cross(aim, across)), dot(to, across));
        const on = cosFade.greaterThan(cosCone).and(inReach).and(facesIt);
        dash.assign(
          select(on.and(fract(round.mul(DASHES / (2 * Math.PI))).lessThan(0.5)), float(1), float(0)),
        );
      })
      .ElseIf(kind.equal(5), () => {
        // (The rim: by how far the point turns from the eye, the view leaned by its turn.)
        const view = transpose(rimTurn).mul(normalize(eye.sub(hit)));
        const facing = dot(normalize(hit.sub(centre)), normalize(view)).toVar();
        main.assign(facing.sub(mainAt));
        faint.assign(facing.sub(faintAt));
      })
      .Else(() => {
        const look = transpose(lightAxes).mul(eye.sub(centre));
        const facing = dot(n, normalize(look)).toVar();
        main.assign(facing.sub(mainAt));
        faint.assign(facing.sub(faintAt));
      });
    // (Half as strong fainter than where it stops, a third as bright; dashed between; all of it
    // gone at the sphere's outline, where it turns from the eye too steeply for a line to read.)
    const edgeOn = smoothstep(0.05, 0.25, dot(normalize(hit.sub(centre)), d.negate()));
    const ends = max(max(line(main).mul(mainOn), line(reach).mul(reachOn)), line(side).mul(sideOn));
    const a = max(ends, max(line(faint).mul(0.3), line(dashed).mul(dash).mul(0.6)))
      .mul(edgeOn)
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
