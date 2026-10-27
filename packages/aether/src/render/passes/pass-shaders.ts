import {
  AddEquation,
  AlwaysDepth,
  CustomBlending,
  DoubleSide,
  LessEqualDepth,
  type Node,
  NodeMaterial,
  QuadMesh,
  type Renderer,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor,
  type Texture,
  ZeroFactor,
} from 'three/webgpu';
import {
  array,
  clamp,
  Discard,
  dot,
  floor,
  Fn,
  If,
  ivec2,
  max,
  mix,
  mod,
  positionGeometry,
  screenCoordinate,
  select,
  texture,
  textureLoad,
  uv,
  vertexIndex,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { blend } from '../materials/blend-shader';
import type { ShaderUniforms } from '../uniforms/shader-uniforms';
import { cold, coldDepth, coldVertex } from '../cold-shaders';

/**
 * three.js's full-screen triangle, as `QuadMesh` draws it: set on a pass's material for good (a
 * `QuadMesh` swaps its own in only while it draws, so its program compiled ahead was another, and
 * the cold nonce never reached it), so it compiles ahead as it draws (`PassQuad`).
 */
const fullscreen = (): Node<'vec4'> => {
  const at = (values: number[]) =>
    (array(values as never) as unknown as { element(i: Node<'uint'>): Node<'float'> }).element(
      vertexIndex as Node<'uint'>,
    );
  return vec4(at([-1.0, -1.0, 3.0]), at([3.0, -1.0, -1.0]), 0.0, 1.0);
};

/** A pass drawn over its whole target with its material's own vertex stage (the full-screen triangle, see `fullscreen`). */
export class PassQuad extends QuadMesh {
  override render(renderer: Renderer): void {
    renderer.render(this, this.camera);
  }
}

/**
 * The renderer's other shaders, in three.js's shading language: putting a target over another, its
 * depth into another, a body's bake back into the frame, the bloom, the tone mapping, the
 * particles, and the editor's beams and outlines.
 *
 * Pixels are read where the pixel is (`screenCoordinate`, from the top left on both APIs); depths
 * written and read are WebGL's, 0 to 1 (see `bodyNodes`).
 */

/** A clip-space position into the API's (WebGPU's depth runs 0 to w, WebGL's -w to w). */
export type ToClip = (clip: Node<'vec4'>) => Node<'vec4'>;

/** The pixel under the fragment, as integer texel coordinates. */
export const pixel = () => ivec2(floor(screenCoordinate.xy));

/**
 * A blend set on a material: opaque, alpha and over premultiplied (its colour over what is there,
 * as far as its alpha covers), add and alphaAdd its light added (the alpha left as it is), darken
 * what is there cut by its colour; none, written as it is.
 */
export function setBlend(
  m: NodeMaterial,
  kind: 'opaque' | 'alpha' | 'add' | 'alphaAdd' | 'over' | 'none' | 'darken',
): void {
  m.depthFunc = LessEqualDepth;
  m.side = DoubleSide;
  // One draw with nothing culled: three.js would draw a transparent two-sided material twice (its
  // back faces, then its front), each with a pipeline of its own that compileAsync didn't build
  // (WebGPU then builds them at their first draw, holding the GPU up).
  m.forceSinglePass = true;
  if (kind === 'none') {
    m.blending = NoBlending;
    m.transparent = false;
    return;
  }
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendEquationAlpha = AddEquation;
  m.transparent = kind !== 'opaque';
  if (kind === 'opaque' || kind === 'alpha' || kind === 'over') {
    m.blendSrc = OneFactor;
    m.blendDst = OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = OneFactor;
    m.blendDstAlpha = OneMinusSrcAlphaFactor;
    return;
  }
  if (kind === 'darken') {
    m.blendSrc = ZeroFactor;
    m.blendDst = OneMinusSrcColorFactor;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
    return;
  }
  // Added light covers nothing: the alpha (what a backdrop shows under) is left as it is.
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  m.blendSrcAlpha = ZeroFactor;
  m.blendDstAlpha = OneFactor;
}

/** A material with no depth test: drawn over what is there (`depthTest` off writes no depth either). */
export function overlay(m: NodeMaterial): NodeMaterial {
  m.depthTest = false;
  m.depthWrite = false;
  return m;
}

/** A target's colour over what is there, as far as its alpha covers. */
export function compositeMaterial(source: Texture, sameSize: boolean): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = sameSize ? 'composite' : 'composite:skyLight';
  m.vertexNode = fullscreen();
  setBlend(m, 'over');
  // Pixel for pixel where it is the frame's size; filtered where it is drawn smaller (the sky light).
  m.fragmentNode = cold(sameSize ? textureLoad(source, pixel()) : texture(source, uv()));
  coldVertex(m);
  return m;
}

/** A target's picture copied over another's, as it is (no blend). */
export function copyMaterial(source: Texture): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'copy';
  m.vertexNode = fullscreen();
  setBlend(m, 'none');
  m.fragmentNode = cold(textureLoad(source, pixel()));
  coldVertex(m);
  return m;
}

/**
 * A target drawn at half its size (`setRenderTarget`'s target), each pixel the mean of the four it
 * covers (read filtered at their shared corner): a mipmap level made, as the GPU makes them.
 */
export function downsampleMaterial(source: Texture): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'downsample';
  m.vertexNode = fullscreen();
  setBlend(m, 'none');
  m.fragmentNode = cold(texture(source, uv()));
  coldVertex(m);
  return m;
}

/** A target's depth written into another's, as it is (no colour). */
export function copyDepthMaterial(source: Texture): NodeMaterial {
  const m = new NodeMaterial();
  m.name = 'copyDepth';
  m.vertexNode = fullscreen();
  setBlend(m, 'none');
  m.depthTest = true;
  m.depthWrite = true;
  m.depthFunc = AlwaysDepth;
  m.colorWrite = false;
  m.depthNode = coldDepth(textureLoad(source, pixel()).x);
  m.fragmentNode = cold(vec4(0));
  coldVertex(m);
  return m;
}

/**
 * A body's bake put back into the frame pixel for pixel: its rectangle (in
 * the frame's normalized device coordinates, `uRect`), the bake's corner in the frame (`uOrigin`,
 * pixels from the top left). Pass 0 gives the frame its opaque pixels' depths; pass 1 its colour
 * at its depth where it has one, else at its nearest (`uFront`). One material for every bake: its
 * colour and depth are each draw's (`colour`, `depth`: `u` reads each draw's values), so nothing
 * is built or compiled when a bake is made or resized.
 */
export function impostorMaterial(
  u: ShaderUniforms,
  placeholder: Texture,
  depthPlaceholder: Texture,
  pass: 0 | 1,
  toClip: ToClip,
): NodeMaterial {
  const m = new NodeMaterial();
  m.name = pass === 0 ? 'impostor:depth' : 'impostor:colour';
  const rect = u.vec4('uRect');
  const origin = u.vec2('uOrigin');
  const front = u.float('uFront');
  m.vertexNode = Fn(() => {
    const corner = positionGeometry.xy.add(1).mul(0.5);
    return toClip(vec4(mix(rect.xy, rect.zw, corner), 0, 1));
  })();
  const at = pixel().sub(ivec2(origin));
  const colourAt = textureLoad(u.texture('colour', placeholder, true), at);
  const depthAt = textureLoad(u.texture('depth', depthPlaceholder, true), at);
  if (pass === 0) {
    setBlend(m, 'none');
    m.colorWrite = false;
    m.depthTest = true;
    m.depthWrite = true;
    m.depthNode = coldDepth(depthAt.x);
    m.fragmentNode = Fn(() => {
      const c = colourAt.toVar();
      const d = depthAt.x.toVar();
      If(d.greaterThanEqual(1).or(c.a.lessThan(0.999)), () => {
        Discard();
      });
      return cold(vec4(0));
    })();
  } else {
    setBlend(m, 'over');
    m.depthTest = true;
    m.depthWrite = false;
    m.depthNode = Fn(() => {
      const d = depthAt.x.toVar();
      If(d.greaterThanEqual(1), () => {
        d.assign(front);
      });
      return d;
    })();
    m.fragmentNode = Fn(() => {
      const c = colourAt.toVar();
      If(dot(c, c).equal(0), () => {
        Discard();
      });
      return cold(c);
    })();
  }
  coldVertex(m);
  return m;
}

/** The bloom's first pass: the frame's bright part and the bodies' own glow, a quarter of four texels each. */
export function bloomPrepassMaterial(
  frame: Texture,
  glow: Texture,
  step: Node<'vec2'>,
  threshold: Node<'float'>,
): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'bloomPrepass';
  m.vertexNode = fullscreen();
  setBlend(m, 'none');
  m.fragmentNode = Fn(() => {
    const at = uv().toVar();
    const four = (t: Texture) =>
      texture(t, at.add(step.mul(vec2(-0.5, -0.5))))
        .rgb.add(texture(t, at.add(step.mul(vec2(0.5, -0.5)))).rgb)
        .add(texture(t, at.add(step.mul(vec2(-0.5, 0.5)))).rgb)
        .add(texture(t, at.add(step.mul(vec2(0.5, 0.5)))).rgb)
        .mul(0.25);
    return cold(vec4(max(four(frame).sub(threshold), 0).add(four(glow)), 1));
  })();
  coldVertex(m);
  return m;
}

/** The bloom blurred along `step` (nine taps). */
export function bloomBlurMaterial(source: Texture, step: Node<'vec2'>): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'bloomBlur';
  m.vertexNode = fullscreen();
  setBlend(m, 'none');
  const weights = [0.227, 0.194, 0.121, 0.054, 0.016];
  m.fragmentNode = Fn(() => {
    const at = uv().toVar();
    const sum = texture(source, at).rgb.mul(weights[0]!).toVar();
    for (let i = 1; i < 5; i++) {
      sum.addAssign(texture(source, at.add(step.mul(i))).rgb.mul(weights[i]!));
      sum.addAssign(texture(source, at.sub(step.mul(i))).rgb.mul(weights[i]!));
    }
    return cold(vec4(sum, 1));
  })();
  coldVertex(m);
  return m;
}

/**
 * The tone mapping: the scene and its bloom exposed, its luminance to the white
 * point; the tint, fading from the one before; an editing backdrop under what the scene covers.
 * Its uniforms: uExposure, uWhitePoint, uFade, uBloomStrength, uTint0/1, uBlend0/1, uBackdrop,
 * uBackdropA/B, uGridSize, uHeight (the canvas's, for the backdrop's grid from the bottom left).
 */
export function toneMaterial(u: ShaderUniforms, scene: Texture, bloom: Texture): NodeMaterial {
  const m = overlay(new NodeMaterial());
  m.name = 'tone';
  m.vertexNode = fullscreen();
  setBlend(m, 'none');
  m.fragmentNode = Fn(() => {
    const sceneAt = textureLoad(scene, pixel()).toVar();
    const hdr = sceneAt.rgb.add(texture(bloom, uv()).rgb.mul(u.float('uBloomStrength'))).toVar();
    const exposure = u.float('uExposure', 1);
    const white = u.float('uWhitePoint', 1);
    const light = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
    const c = hdr.mul(exposure).toVar();
    const l = light.mul(exposure).toVar();
    const mapped = l.mul(l.div(white.mul(white)).add(1)).div(l.add(1));
    const toned = clamp(select(l.greaterThan(0), c.mul(mapped.div(l)), c), 0, 1).toVar();
    const shown = mix(
      blend(toned, u.vec3('uTint1'), u.int('uBlend1')),
      blend(toned, u.vec3('uTint0'), u.int('uBlend0')),
      u.float('uFade', 1),
    ).toVar();
    const backdrop = u.int('uBackdrop');
    If(backdrop.greaterThan(0), () => {
      // The grid's squares from the bottom left, as WebGL's fragment coordinates have them.
      const at = vec2(screenCoordinate.x, u.float('uHeight').sub(screenCoordinate.y));
      const cell = floor(at.div(u.float('uGridSize', 1))).toVar();
      const second = backdrop.equal(2).and(mod(cell.x.add(cell.y), 2).greaterThanEqual(1));
      const back = select(second, u.vec3('uBackdropB'), u.vec3('uBackdropA'));
      shown.assign(clamp(shown.add(back.mul(clamp(sceneAt.a, 0, 1).oneMinus())), 0, 1));
    });
    return cold(vec4(shown, 1));
  })();
  coldVertex(m);
  return m;
}
