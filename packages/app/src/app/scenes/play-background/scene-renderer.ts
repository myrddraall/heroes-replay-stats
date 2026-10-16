import {
  type LoadedPlayScene,
  layerOffset,
  type LayerChannel,
  type SceneLayer,
  type SceneMaterial,
  type SceneMesh,
} from './play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from './scene-particles';
import type { LoadedPlanet, PlanetLight } from './scene-planets';
import { BLEND_GLSL, BLEND_MODES, NO_TINTS, PLANETS, type Tints } from './scene-tints';

/** A target's outputs: the colour, the planets' light and their bodies (COLOR_ATTACHMENT0 to 2). */
const DRAW_BUFFERS = [0x8ce0, 0x8ce1, 0x8ce2];

const CHANNELS: Record<LayerChannel, number> = { rgb: 0, rgba: 1, a: 2, r: 3, g: 4, b: 5 };
/** A material's layer slots, in the shader's order, and their samplers. */
const SLOTS = ['uDiffuse', 'uEmissive', 'uMask0', 'uMask1'] as const;

/**
 * How strongly a layer's brightness multiplier acts: the data's value, squared. Measured, as the
 * data doesn't say: against a screenshot of the game's Play screen, squared multipliers give its
 * colours (within 1-4 levels of 255), the faint energy wisps and the faint stars' count; taken as
 * they are, the energy's wisps came out about three times too strong and the stars too few.
 */
export function layerBrightness(brightMult: number): number {
  return brightMult * brightMult;
}

const MESH_VERTEX = `#version 300 es
in vec3 aPosition;
in vec2 aUv;
in vec2 aUv2;
in vec3 aNormal;
in vec4 aColor;
uniform mat4 uViewProjection;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
out vec2 vUv;
out vec2 vUv2;
out vec3 vNormal;
out vec3 vWorld;
out vec4 vColor;
void main() {
  vUv = aUv;
  vUv2 = aUv2;
  vNormal = uNormalMatrix * aNormal;
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vColor = aColor;
  gl_Position = uViewProjection * world;
}`;

/**
 * A material as the game's standard material draws one of these: the colour is the diffuse layer
 * (unshaded materials only: the lit ones here draw nothing but their emissive) plus the emissive
 * layer; the alpha is the alpha masks' product (and the vertex alpha, where the material uses it).
 * Each layer reads its channel, in the mesh's first or second texture coordinates (its uvSet),
 * through its tiling about the texture's centre, less its offset (the
 * offset moves the texture: the scrolls then carry the energy inwards, as the game's sequence names
 * it, and the nebula sits where the game shows it), and its rotation. A layer's midtone offset lifts
 * its middle values (a gamma curve; the data doesn't say which curve, and it changes little here).
 * A layer may be a colour of its own instead of a texture, and may fade by its fresnel: from its
 * minimum where the surface faces the camera to its maximum edge-on, the view first turned by its
 * yaw and pitch (the planets' hex grid brightens towards one side of their rims). The game's
 * fresnel comes out squared and brighter than that formula: measured against a Quick Match
 * screenshot, the planets' hex grid matches the formula's square times FRESNEL_GAIN, where the
 * formula alone left it all but invisible (the data doesn't say why); that was measured on the
 * grid's kind of fresnel (type 1), and the inverted kind (type 2, the flyby planets' atmospheres
 * and city lights, strongest facing the camera) is taken as the formula gives it, unmeasured. A
 * mask layer's fresnel scales its mask the same way. The emissive
 * layer adds to the diffuse colour, or multiplies it (mod, twice for mod2x). A blended material's
 * output is premultiplied; an opaque one's is cut out where its alpha falls below its threshold.
 * A lit material (a flyby planet's) takes its diffuse colour times the light on it: the ambient
 * colour plus each directional light's colour by how squarely the surface faces against the way it
 * travels, as the game's standard material is lit (its specular left out), scaled by the exposure
 * the light was set for over the scene's own. A material that uses the vertex colour multiplies
 * its diffuse by it.
 */
const MESH_FRAGMENT = `#version 300 es
precision highp float;
struct Layer {
  bool used; bool textured; vec4 color; int uvSet; int channel; float bright; float midtone;
  vec2 offset; float angle; vec2 tiling;
  int fresnel; float fExponent; float fMin; float fMax; vec2 fTurn;
};
const float FRESNEL_GAIN = 4.3;
uniform sampler2D uDiffuse, uEmissive, uMask0, uMask1;
uniform Layer uLayers[4];
uniform bool uUnshaded, uVertexAlpha, uVertexColor, uOpaque;
uniform int uEmissiveBlend;
uniform float uEmissiveMult, uCutout;
uniform float uSmear;
uniform bool uLit;
uniform vec3 uAmbient;
uniform vec3 uLightDir[3];
uniform vec3 uLightColor[3];
uniform int uLightCount;
uniform float uLightScale;
const vec3 LUMINANCE = vec3(0.2126, 0.7152, 0.0722);
uniform vec3 uEye, uRight, uUp;
in vec2 vUv;
in vec2 vUv2;
in vec3 vNormal;
in vec3 vWorld;
in vec4 vColor;
uniform vec3 uPlanet;
uniform bool uAdds;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outCover;
layout(location = 2) out vec4 outBody;

// A layer's texture coordinates, the mesh's shifted by du along u first (the sky's go right round).
vec2 layerUvFrom(Layer l, float du) {
  vec2 t = ((l.uvSet == 2 ? vUv2 : vUv) + vec2(du, 0.0) - 0.5 - l.offset) * l.tiling;
  float c = cos(l.angle), s = sin(l.angle);
  return mat2(c, s, -s, c) * t + 0.5;
}
vec2 layerUv(Layer l) {
  return layerUvFrom(l, 0.0);
}
vec4 channel(vec4 texel, int c) {
  if (c == 0) return vec4(texel.rgb, 1.0);
  if (c == 1) return texel;
  float v = c == 2 ? texel.a : c == 3 ? texel.r : c == 4 ? texel.g : texel.b;
  return vec4(v);
}
vec3 turn(vec3 v, vec3 axis, float angle) {
  return v * cos(angle) + cross(axis, v) * sin(angle) + axis * dot(axis, v) * (1.0 - cos(angle));
}
float fresnel(Layer l) {
  if (l.fresnel == 0) return 1.0;
  vec3 view = turn(turn(normalize(uEye - vWorld), uUp, l.fTurn.x), uRight, l.fTurn.y);
  float f = mix(l.fMin, l.fMax, pow(1.0 - clamp(dot(normalize(vNormal), view), 0.0, 1.0), l.fExponent));
  return l.fresnel == 2 ? 1.0 - f : f * f * FRESNEL_GAIN;
}
vec4 midtone(vec4 v, float m) {
  return m > 0.0 ? pow(v, vec4(1.0 / (1.0 + m))) : v;
}
// A layer's texel; smeared across the mesh's u by uSmear (of the way round the sky: the same
// sweep for every layer whatever its tiling) as the view sweeps in a fly.
vec4 texel(sampler2D tex, Layer l) {
  if (uSmear <= 0.0) return texture(tex, layerUv(l));
  vec4 sum = vec4(0.0);
  for (int k = -3; k <= 3; k++) sum += texture(tex, layerUvFrom(l, float(k) * uSmear / 3.0));
  return sum / 7.0;
}
vec4 colorLayer(sampler2D tex, Layer l) {
  if (!l.used) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 v = l.textured ? midtone(channel(texel(tex, l), l.channel), l.midtone) : l.color;
  return vec4(v.rgb * l.bright * fresnel(l), v.a);
}
float maskLayer(sampler2D tex, Layer l) {
  if (!l.used) return 1.0;
  float v = clamp(channel(texture(tex, layerUv(l)), l.channel).a * l.bright, 0.0, 1.0);
  return midtone(vec4(v), l.midtone).a * clamp(fresnel(l), 0.0, 1.0);
}
vec3 lit(vec3 albedo) {
  vec3 n = normalize(vNormal);
  vec3 light = uAmbient;
  for (int i = 0; i < 3; i++) {
    if (i < uLightCount) light += uLightColor[i] * max(0.0, dot(n, -normalize(uLightDir[i])));
  }
  return albedo * light * uLightScale;
}
void main() {
  vec4 diffuse = colorLayer(uDiffuse, uLayers[0]);
  if (uVertexColor) diffuse.rgb *= vColor.rgb;
  vec4 emissive = colorLayer(uEmissive, uLayers[1]);
  vec3 base = uUnshaded ? diffuse.rgb : uLit ? lit(diffuse.rgb) : vec3(0.0);
  vec3 glow = emissive.rgb * uEmissiveMult;
  vec3 rgb = uEmissiveBlend == 2 ? base + glow : base * glow * (uEmissiveBlend == 1 ? 2.0 : 1.0);
  float alpha = maskLayer(uMask0, uLayers[2]) * maskLayer(uMask1, uLayers[3]) * diffuse.a;
  if (uVertexAlpha) alpha *= vColor.a;
  if (uOpaque) {
    if (alpha < uCutout) discard;
    outColor = vec4(rgb, 1.0);
  } else {
    outColor = vec4(rgb * alpha, alpha);
  }
  // The light it gives, as its planet's (blended as the colour is, so it is what reaches the pixel).
  outCover = vec4(uPlanet * dot(outColor.rgb, LUMINANCE), outColor.a);
  // How much it hides what is behind it, as its planet's: light added hides nothing.
  outBody = uAdds ? vec4(0.0) : vec4(uPlanet * outColor.a, outColor.a);
}`;

/**
 * A particle as a square facing the camera, its size its side (the brightest stars then come out
 * as wide, and as many, as in a screenshot of the game); streaked across the view while the
 * background flies to another set of planets (uStreak, 0 to 1): drawn out to STREAK_LENGTH times
 * its size, thinned and dimmed as it goes, as a star smears when the view sweeps.
 */
const PARTICLE_VERTEX = `#version 300 es
const float STREAK_LENGTH = 14.0;
in vec2 aCorner;
in vec4 aParticle;
in vec4 aParticleColor;
uniform mat4 uView, uProjection;
uniform float uStreak;
out vec2 vUv;
out vec4 vColor;
void main() {
  vec4 at = uView * vec4(aParticle.xyz, 1.0);
  at.x += aCorner.x * aParticle.w * (1.0 + uStreak * STREAK_LENGTH);
  at.y += aCorner.y * aParticle.w * mix(1.0, 0.3, uStreak);
  vUv = aCorner + 0.5;
  vColor = vec4(aParticleColor.rgb, aParticleColor.a * mix(1.0, 0.55, uStreak));
  gl_Position = uProjection * at;
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform int uChannel;
uniform float uBright;
in vec2 vUv;
in vec4 vColor;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outCover;
layout(location = 2) out vec4 outBody;
void main() {
  outCover = vec4(0.0); // the stars are the sky's
  outBody = vec4(0.0);
  vec4 t = texture(uTexture, vUv);
  vec3 c = uChannel <= 1 ? t.rgb : vec3(uChannel == 2 ? t.a : uChannel == 3 ? t.r : uChannel == 4 ? t.g : t.b);
  outColor = vec4(c * uBright * vColor.rgb * vColor.a, 0.0);
}`;

const TONE_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * The light's HDR tone mapping: the scene scaled by its exposure, its luminance through Reinhard's
 * curve to the light's white point (what reaches it shows as white). The data gives the exposure
 * and white point but not the curve (its operator is a number); on luminance this one matches the
 * game's screenshot within a few levels, where the same curve per channel darkens the blues too much.
 * Then the tints, as CSS blends a colour over the picture: each planet's on its part of the pixel,
 * the background's on the rest; fading from the tints before (uTint[4..7]) to the tints now
 * (uTint[0..3]) by uFade. A planet's part is the share of the pixel's light it gives (its glow at
 * the rim, over the sky), or how much its body hides the sky, whichever is more (so the sky's
 * energy drifting over a planet takes the planet's tint).
 */
const TONE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uScene, uCover, uBody;
uniform float uExposure, uWhitePoint, uFade;
uniform vec3 uTint[8];
uniform int uBlend[8];
in vec2 vUv;
out vec4 outColor;
${BLEND_GLSL}
vec3 tinted(vec3 c, vec3 share, int first) {
  return blend(c, uTint[first], uBlend[first]) * (1.0 - share.r - share.g - share.b)
    + blend(c, uTint[first + 1], uBlend[first + 1]) * share.r
    + blend(c, uTint[first + 2], uBlend[first + 2]) * share.g
    + blend(c, uTint[first + 3], uBlend[first + 3]) * share.b;
}
void main() {
  vec3 hdr = texture(uScene, vUv).rgb;
  float light = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  vec3 share = max(texture(uCover, vUv).rgb / max(light, 1e-4), texture(uBody, vUv).rgb);
  share /= max(1.0, share.r + share.g + share.b);
  vec3 c = hdr * uExposure;
  float l = light * uExposure;
  float mapped = l * (1.0 + l / (uWhitePoint * uWhitePoint)) / (1.0 + l);
  c = clamp(l > 0.0 ? c * (mapped / l) : c, 0.0, 1.0);
  outColor = vec4(mix(tinted(c, share, 4), tinted(c, share, 0), uFade), 1.0);
}`;

type Vec3 = readonly [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A view matrix (column-major) for an eye looking along `forward`, `up` as near up as it allows. */
export function viewMatrix(eye: Vec3, forward: Vec3, up: Vec3): Float32Array {
  const f = normalize(forward);
  const r = normalize(cross(f, up));
  const u = cross(r, f);
  return new Float32Array([
    r[0],
    u[0],
    -f[0],
    0,
    r[1],
    u[1],
    -f[1],
    0,
    r[2],
    u[2],
    -f[2],
    0,
    -dot(r, eye),
    -dot(u, eye),
    dot(f, eye),
    1,
  ]);
}

/** A perspective projection (column-major) with a vertical field of view in degrees. */
export function projectionMatrix(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const t = 1 / Math.tan((fovY * Math.PI) / 360);
  return new Float32Array([
    t / aspect,
    0,
    0,
    0,
    0,
    t,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ]);
}

/** A vector turned about an axis (unit) by an angle in radians. */
function turnAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const d = dot(axis, v) * (1 - c);
  return [
    v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d,
  ];
}

/**
 * Draws in drawing order: opaque first (they write depth), then the blended ones by the model's
 * priority, highest first, as the game draws a model's materials (the order of equal ones is kept).
 */
function sorted(draws: readonly MeshDraw[]): MeshDraw[] {
  return [...draws].sort(
    (a, b) =>
      Number(a.material.blend !== 'opaque') - Number(b.material.blend !== 'opaque') ||
      (b.material.priority ?? 0) - (a.material.priority ?? 0),
  );
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
}

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const p = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? 'program');
  return p;
}

/** One material drawn on one mesh; moving when one of its layers scrolls. */
interface MeshDraw {
  readonly vao: WebGLVertexArrayObject;
  readonly count: number;
  readonly material: SceneMaterial;
  readonly moving: boolean;
  /** Which planet it draws (one channel per planet, in PLANETS' order), or none. */
  readonly planet: readonly [number, number, number];
  /** The planet it is part of (a placed one), whose matrices place it; none: in world space as it is. */
  readonly placed?: Placed;
  /** How it is lit, where it is a lit material of a flyby planet. */
  readonly light?: PlanetLight;
}

/** A planet put up in the scene: where, how big, and which tint channel is its. */
export interface PlanetPlacement {
  readonly planet: LoadedPlanet;
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
  /** Which of the tints is its (0 to 2, in PLANETS' order), or none (-1). */
  readonly slot: number;
}

/** A placement with its matrices as last placed. */
interface Placed {
  placement: PlanetPlacement;
  model: Float32Array;
  normal: Float32Array;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const IDENTITY3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/**
 * A planet's model matrix (column-major) and its normal matrix: at its position, at its radius,
 * turned so that its own -Y (the way its body faces) points at the eye, by the shortest turn, as
 * the game's billboards turn.
 */
export function placementMatrices(
  position: Vec3,
  radius: number,
  eye: Vec3,
): [Float32Array, Float32Array] {
  const wanted = normalize([eye[0] - position[0], eye[1] - position[1], eye[2] - position[2]]);
  const current: Vec3 = [0, -1, 0];
  const axis = cross(current, wanted);
  const sin = Math.hypot(...axis);
  const cos = dot(current, wanted);
  let r: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // row-major 3x3
  if (sin > 1e-9) {
    const k: Vec3 = [axis[0] / sin, axis[1] / sin, axis[2] / sin];
    // Rodrigues: I + sin K + (1 - cos) K², K the cross-product matrix of the axis.
    const K = [0, -k[2], k[1], k[2], 0, -k[0], -k[1], k[0], 0];
    const KK = Array.from({ length: 9 }, (_, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      return K[row * 3]! * K[col]! + K[row * 3 + 1]! * K[3 + col]! + K[row * 3 + 2]! * K[6 + col]!;
    });
    r = r.map((v, i) => v + sin * K[i]! + (1 - cos) * KK[i]!);
  } else if (cos < 0) {
    r = [-1, 0, 0, 0, -1, 0, 0, 0, 1]; // turned right round
  }
  // Column-major: column c holds each row's c-th value.
  const normal = new Float32Array([r[0]!, r[3]!, r[6]!, r[1]!, r[4]!, r[7]!, r[2]!, r[5]!, r[8]!]);
  const model = new Float32Array([
    ...[r[0]! * radius, r[3]! * radius, r[6]! * radius, 0],
    ...[r[1]! * radius, r[4]! * radius, r[7]! * radius, 0],
    ...[r[2]! * radius, r[5]! * radius, r[8]! * radius, 0],
    ...[position[0], position[1], position[2], 1],
  ]);
  return [model, normal];
}

/** A float render target (half floats where the browser can render to them), with depth. */
interface Target {
  readonly framebuffer: WebGLFramebuffer;
  readonly depth: WebGLRenderbuffer;
  texture: WebGLTexture | null;
  /** The light each planet gives each pixel, one channel per planet (its luminance, as the colour's). */
  cover: WebGLTexture | null;
  /** How much each planet's body hides the pixel's sky, one channel per planet. */
  body: WebGLTexture | null;
}

const moves = (m: SceneMaterial) =>
  [m.diffuse, m.emissive, ...m.alphaMasks].some((layer) => layer?.scroll);

interface ParticleDraw {
  readonly system: ParticleSystem;
  readonly vao: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
  readonly material: SceneMaterial;
}

/**
 * Draws the scene into a canvas with WebGL 2: the meshes through the game's camera, then the
 * particles as camera-facing squares, into a half-float target (light adds up past white, as in
 * the game's HDR), tone-mapped onto the canvas. Opaque materials (the planets) draw first and hide
 * what is behind them; the blended ones follow by priority. What doesn't move (the sky's nebula and
 * stars, the planets) is drawn once per size into a target of its own, colour and depth, and each
 * frame starts from a copy of it, drawing only what moves (the energy's scroll, the particles).
 * Each target also keeps the light each planet gives each pixel, for the planets' own tints.
 */
export class SceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly meshProgram: WebGLProgram;
  private readonly particleProgram: WebGLProgram;
  private readonly toneProgram: WebGLProgram;
  private readonly textures = new Map<string, WebGLTexture>();
  /** How layers sample their textures, by whether they repeat across u (1) and across v (2). */
  private readonly samplers: WebGLSampler[];
  private readonly vaos: WebGLVertexArrayObject[] = [];
  /** The scene's own draws (its sky), then the placed planets'. */
  private readonly sceneDraws: MeshDraw[] = [];
  private draws: MeshDraw[] = [];
  /** The placed planets' meshes on the GPU, by planet and mesh; kept while the renderer lives. */
  private readonly planetVaos = new Map<string, { vao: WebGLVertexArrayObject; count: number }>();
  private placed: Placed[] = [];
  private readonly particles: ParticleDraw[] = [];
  private readonly uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  /** The targets' format: half floats where the browser can render to them, else bytes. */
  private readonly format: number;
  /** What doesn't move, drawn once per size. */
  private readonly still: Target;
  /** The frame before tone mapping. */
  private readonly frame: Target;
  private view: Float32Array = new Float32Array(16);
  private projection: Float32Array = new Float32Array(16);
  /** The camera turned from where the scene puts it, about its up, in radians. */
  private yaw = 0;
  /** Whether what doesn't move has to be drawn again before the next frame. */
  private stillDirty = true;

  /** Throws when the browser has no WebGL 2. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly loaded: LoadedPlayScene,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL 2 is not available');
    this.gl = gl;
    this.meshProgram = program(gl, MESH_VERTEX, MESH_FRAGMENT);
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.toneProgram = program(gl, TONE_VERTEX, TONE_FRAGMENT);
    this.samplers = [0, 1, 2, 3].map((wrap) => {
      const s = gl.createSampler();
      gl.samplerParameteri(s, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.samplerParameteri(s, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.samplerParameteri(s, gl.TEXTURE_WRAP_S, wrap & 1 ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.samplerParameteri(s, gl.TEXTURE_WRAP_T, wrap & 2 ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      return s;
    });
    this.format = gl.getExtension('EXT_color_buffer_float') !== null ? gl.RGBA16F : gl.RGBA8;
    this.still = {
      framebuffer: gl.createFramebuffer(),
      depth: gl.createRenderbuffer(),
      texture: null,
      cover: null,
      body: null,
    };
    this.frame = {
      framebuffer: gl.createFramebuffer(),
      depth: gl.createRenderbuffer(),
      texture: null,
      cover: null,
      body: null,
    };
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    for (const [key, image] of Object.entries(loaded.images))
      this.textures.set(key, this.texture(image));
    const { scene } = loaded;
    for (const [name, mesh] of Object.entries(scene.meshes)) {
      if (!mesh.materials.length) continue; // an emitter, not drawn
      if (mesh.planet) continue; // the scene's own planets: put up as placed planets instead
      const vao = this.meshVao(mesh);
      this.vaos.push(vao);
      for (const m of mesh.materials) {
        const material = this.material(m, name, scene.materials);
        this.sceneDraws.push({
          vao,
          count: mesh.indices.length,
          material,
          moving: moves(material),
          planet: [0, 0, 0],
        });
      }
    }
    for (const system of scene.particles) {
      const emitter = scene.meshes[system.emitter];
      if (!emitter) throw new Error(`the particles' emitter ${system.emitter} isn't in the scene`);
      const particles = new ParticleSystem(system, emitter);
      const [vao, buffer] = this.particleVao(particles);
      this.particles.push({
        system: particles,
        vao,
        buffer,
        material: this.material(system.material, 'particles', scene.materials),
      });
    }
    this.draws = sorted(this.sceneDraws);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
  }

  /**
   * The planets put up in the scene, replacing those there were: their meshes go to the GPU the
   * first time each planet is placed. What doesn't move is drawn again at the next frame.
   */
  setPlanets(placements: readonly PlanetPlacement[]): void {
    const { eye } = this.loaded.scene.camera;
    this.placed = placements.map((placement) => {
      const [model, normal] = placementMatrices(placement.position, placement.radius, eye);
      return { placement, model, normal };
    });
    const draws: MeshDraw[] = [];
    for (const placed of this.placed) {
      const { planet, slot } = placed.placement;
      const channels = PLANETS.map((_, i) => (i === slot ? 1 : 0)) as [number, number, number];
      for (const [name, mesh] of Object.entries(planet.planet.meshes)) {
        const key = `${planet.id}/${name}`;
        let vao = this.planetVaos.get(key);
        if (!vao) {
          for (const [textureKey, image] of Object.entries(planet.images))
            if (!this.textures.has(textureKey)) this.textures.set(textureKey, this.texture(image));
          vao = { vao: this.meshVao(mesh), count: mesh.indices.length };
          this.planetVaos.set(key, vao);
        }
        for (const m of mesh.materials) {
          const material = this.material(m, key, planet.planet.materials);
          draws.push({
            vao: vao.vao,
            count: vao.count,
            material,
            moving: moves(material),
            planet: channels,
            placed,
            light: material.unshaded ? undefined : planet.planet.light,
          });
        }
      }
    }
    this.draws = [...sorted(this.sceneDraws), ...sorted(draws)];
    this.stillDirty = true;
  }

  /**
   * Where each placed planet is on the canvas, as it was last placed: its centre, and the top of
   * its body, as shares of the canvas's width and height from its top left; none for one behind
   * the camera.
   */
  anchors(): { id: string; x: number; y: number; top: number }[] {
    const viewProjection = multiply(this.projection, this.view);
    const project = (p: Vec3): [number, number] | null => {
      const m = viewProjection;
      const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
      if (w <= 0) return null;
      const x = (m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!) / w;
      const y = (m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!) / w;
      return [(x + 1) / 2, (1 - y) / 2];
    };
    const out: { id: string; x: number; y: number; top: number }[] = [];
    for (const { placement } of this.placed) {
      const { position, radius } = placement;
      const centre = project(position);
      const top = project([position[0], position[1], position[2] + radius]);
      if (centre && top) out.push({ id: placement.planet.id, x: centre[0], y: centre[1], top: top[1] });
    }
    return out;
  }

  /** The placed planets moved: their positions and radii, in the order they were placed. */
  placePlanets(positions: readonly Vec3[], radii?: readonly number[]): void {
    const { eye } = this.loaded.scene.camera;
    this.placed.forEach((placed, i) => {
      const position = positions[i] ?? placed.placement.position;
      const radius = radii?.[i] ?? placed.placement.radius;
      placed.placement = { ...placed.placement, position, radius };
      [placed.model, placed.normal] = placementMatrices(position, radius, eye);
    });
    this.stillDirty = true;
  }

  /** The camera turned about its up from where the scene puts it, in radians. */
  setYaw(yaw: number): void {
    if (yaw === this.yaw) return;
    this.yaw = yaw;
    this.view = this.viewNow();
    this.stillDirty = true;
  }

  private viewNow(): Float32Array {
    const { camera } = this.loaded.scene;
    const forward = turnAbout(camera.forward, camera.up, this.yaw);
    return viewMatrix(camera.eye, forward, camera.up);
  }

  /**
   * The drawing buffer's size, in device pixels; the camera keeps its vertical field of view. What
   * doesn't move is drawn again at the new size.
   */
  resize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    const { camera } = this.loaded.scene;
    this.view = this.viewNow();
    this.projection = projectionMatrix(
      camera.fovY,
      this.canvas.width / this.canvas.height,
      camera.near,
      camera.far,
    );
    this.allocate(this.still);
    this.allocate(this.frame);
    this.stillDirty = true;
  }

  /** What doesn't move, drawn into its target. */
  private drawStill(): void {
    this.begin(this.still);
    this.drawMeshes(false, 0);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.stillDirty = false;
  }

  /** How far the stars are streaked across the view, 0 to 1 (0: not at all). */
  streak = 0;
  /** How far the sky's layers are smeared across, as a share of the way round the sky (0: not at all). */
  smear = 0;
  /** The tints drawn: the background's, then each planet's. */
  tints: Tints = NO_TINTS;
  /** The tints the picture fades from, and how far it is from them to `tints` (1: all the way). */
  fadingFrom: Tints = NO_TINTS;
  fade = 1;

  /** The scene at `seconds` on its clock. */
  draw(seconds: number): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    if (this.stillDirty) this.drawStill();
    // The still part, into the frame: one attachment at a time (a blit copies the one read
    // into every one drawn).
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.still.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.frame.framebuffer);
    for (let i = 0; i < DRAW_BUFFERS.length; i++) {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
      gl.drawBuffers(DRAW_BUFFERS.map((b, j) => (j === i ? b : gl.NONE)));
      const bits = i === 0 ? gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT : gl.COLOR_BUFFER_BIT;
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, bits, gl.NEAREST);
    }
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.drawBuffers(DRAW_BUFFERS);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frame.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.DEPTH_TEST);
    this.drawMeshes(true, seconds);

    // Particles add light, hidden behind what is opaque.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this.particleProgram);
    gl.bindSampler(0, null); // the particles' and the tone pass's textures sample as they are set
    gl.bindSampler(1, null);
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uView'), false, this.view);
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uProjection'), false, this.projection);
    gl.uniform1f(this.uniform(this.particleProgram, 'uStreak'), this.streak);
    for (const p of this.particles) {
      p.system.update(seconds);
      const layer = p.material.diffuse!;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textures.get(layer.texture!)!);
      gl.uniform1i(this.uniform(this.particleProgram, 'uTexture'), 0);
      gl.uniform1i(
        this.uniform(this.particleProgram, 'uChannel'),
        CHANNELS[layer.channel ?? 'rgb'],
      );
      gl.uniform1f(
        this.uniform(this.particleProgram, 'uBright'),
        layerBrightness(layer.brightMult),
      );
      gl.bindVertexArray(p.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.system.instances, 0, p.system.count * INSTANCE_FLOATS);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, p.system.count);
    }
    gl.bindVertexArray(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.toneProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.texture);
    gl.uniform1i(this.uniform(this.toneProgram, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.cover);
    gl.uniform1i(this.uniform(this.toneProgram, 'uCover'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindSampler(2, null);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.body);
    gl.uniform1i(this.uniform(this.toneProgram, 'uBody'), 2);
    const tints = [...this.tints, ...this.fadingFrom];
    gl.uniform3fv(this.uniform(this.toneProgram, 'uTint'), tints.flatMap((t) => [...t.colour]));
    gl.uniform1iv(
      this.uniform(this.toneProgram, 'uBlend'),
      tints.map((t) => BLEND_MODES[t.blend]),
    );
    gl.uniform1f(this.uniform(this.toneProgram, 'uFade'), this.fade);
    gl.uniform1f(this.uniform(this.toneProgram, 'uExposure'), this.loaded.scene.tone.exposure);
    gl.uniform1f(this.uniform(this.toneProgram, 'uWhitePoint'), this.loaded.scene.tone.whitePoint);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Free what the GPU holds; the context goes with the canvas anyway. */
  dispose(): void {
    const gl = this.gl;
    for (const t of this.textures.values()) gl.deleteTexture(t);
    for (const s of this.samplers) gl.deleteSampler(s);
    for (const vao of this.vaos) gl.deleteVertexArray(vao);
    for (const { vao } of this.planetVaos.values()) gl.deleteVertexArray(vao);
    for (const p of this.particles) {
      gl.deleteVertexArray(p.vao);
      gl.deleteBuffer(p.buffer);
    }
    for (const p of [this.meshProgram, this.particleProgram, this.toneProgram]) gl.deleteProgram(p);
    for (const target of [this.still, this.frame]) {
      gl.deleteTexture(target.texture);
      gl.deleteTexture(target.cover);
      gl.deleteTexture(target.body);
      gl.deleteRenderbuffer(target.depth);
      gl.deleteFramebuffer(target.framebuffer);
    }
  }

  /** A target sized to the canvas: a texture's storage is fixed, so a new size is a new texture. */
  private allocate(target: Target): void {
    const gl = this.gl;
    gl.deleteTexture(target.texture);
    target.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.format, this.canvas.width, this.canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.deleteTexture(target.cover);
    target.cover = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target.cover);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.format, this.canvas.width, this.canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.deleteTexture(target.body);
    target.body = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target.body);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, this.canvas.width, this.canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, target.cover, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, target.body, 0);
    gl.drawBuffers(DRAW_BUFFERS);
    gl.bindRenderbuffer(gl.RENDERBUFFER, target.depth);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT24,
      this.canvas.width,
      this.canvas.height,
    );
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target.depth);
  }

  /** Draw into a target from black, nothing in front yet. */
  private begin(target: Target): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
  }

  /** The blend for a material: opaque writes colour and depth; the rest add or blend over. */
  private blend(material: SceneMaterial): void {
    const gl = this.gl;
    if (material.blend === 'opaque') {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      return;
    }
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (material.blend === 'alpha') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE);
  }

  /** The mesh draws that move, or those that don't, into the bound target. */
  private drawMeshes(moving: boolean, seconds: number): void {
    const gl = this.gl;
    gl.useProgram(this.meshProgram);
    gl.uniformMatrix4fv(
      this.uniform(this.meshProgram, 'uViewProjection'),
      false,
      multiply(this.projection, this.view),
    );
    const v = this.view;
    gl.uniform3fv(this.uniform(this.meshProgram, 'uEye'), this.loaded.scene.camera.eye);
    gl.uniform3f(this.uniform(this.meshProgram, 'uRight'), v[0]!, v[4]!, v[8]!);
    gl.uniform3f(this.uniform(this.meshProgram, 'uUp'), v[1]!, v[5]!, v[9]!);
    const p = this.meshProgram;
    const exposure = this.loaded.scene.tone.exposure;
    for (const draw of this.draws) {
      if (draw.moving !== moving) continue;
      gl.bindVertexArray(draw.vao);
      this.blend(draw.material);
      this.bindMaterial(draw.material, seconds);
      gl.uniform3fv(this.uniform(p, 'uPlanet'), draw.planet);
      gl.uniform1f(this.uniform(p, 'uSmear'), draw.placed ? 0 : this.smear);
      gl.uniformMatrix4fv(this.uniform(p, 'uModel'), false, draw.placed?.model ?? IDENTITY);
      gl.uniformMatrix3fv(this.uniform(p, 'uNormalMatrix'), false, draw.placed?.normal ?? IDENTITY3);
      const light = draw.light;
      gl.uniform1i(this.uniform(p, 'uLit'), light ? 1 : 0);
      if (light) {
        const lights = light.directional.slice(0, 3);
        const pad = Array<number>(9 - lights.length * 3).fill(0);
        gl.uniform3fv(this.uniform(p, 'uAmbient'), light.ambient);
        gl.uniform1i(this.uniform(p, 'uLightCount'), lights.length);
        gl.uniform3fv(this.uniform(p, 'uLightDir'), [...lights.flatMap((l) => [...l.direction]), ...pad]);
        gl.uniform3fv(this.uniform(p, 'uLightColor'), [...lights.flatMap((l) => [...l.color]), ...pad]);
        gl.uniform1f(this.uniform(p, 'uLightScale'), light.exposure / exposure);
      }
      gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  private material(
    name: string,
    where: string,
    materials: Readonly<Record<string, SceneMaterial>>,
  ): SceneMaterial {
    const material = materials[name];
    if (!material) throw new Error(`${where}: no material ${name} in the scene`);
    if (!['opaque', 'alpha', 'add', 'alphaAdd'].includes(material.blend))
      throw new Error(`${name}: ${material.blend} blending isn't drawn yet`);
    return material;
  }

  private bindMaterial(material: SceneMaterial, seconds: number): void {
    const gl = this.gl;
    const p = this.meshProgram;
    const layers: (SceneLayer | null | undefined)[] = [
      material.diffuse,
      material.emissive,
      material.alphaMasks[0],
      material.alphaMasks[1],
    ];
    layers.forEach((layer, i) => {
      const at = (field: string) => this.uniform(p, `uLayers[${i}].${field}`);
      gl.uniform1i(at('used'), layer ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0 + i);
      const texture = layer?.texture ? this.textures.get(layer.texture)! : null;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const [u, v] = layer?.wrap ?? [true, true];
      gl.bindSampler(i, texture ? this.samplers[(u ? 1 : 0) | (v ? 2 : 0)]! : null);
      gl.uniform1i(this.uniform(p, SLOTS[i]!), i);
      if (!layer) return;
      gl.uniform1i(at('textured'), texture ? 1 : 0);
      const color = layer.color ?? [255, 255, 255, 255];
      gl.uniform4f(at('color'), color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255);
      gl.uniform1i(at('uvSet'), layer.uvSet ?? 1);
      gl.uniform1i(at('channel'), CHANNELS[layer.channel ?? 'rgb']);
      gl.uniform1f(at('bright'), layerBrightness(layer.brightMult));
      gl.uniform1f(at('midtone'), layer.midtone ?? 0);
      gl.uniform2fv(at('offset'), layerOffset(layer, seconds));
      gl.uniform1f(at('angle'), layer.angle ?? 0);
      gl.uniform2fv(at('tiling'), layer.tiling ?? [1, 1]);
      const f = layer.fresnel;
      gl.uniform1i(at('fresnel'), f?.type ?? 0);
      gl.uniform1f(at('fExponent'), f?.exponent ?? 1);
      gl.uniform1f(at('fMin'), f?.min ?? 0);
      gl.uniform1f(at('fMax'), f?.max ?? 1);
      gl.uniform2f(at('fTurn'), f?.yaw ?? 0, f?.pitch ?? 0);
    });
    gl.uniform1i(this.uniform(p, 'uUnshaded'), material.unshaded ? 1 : 0);
    gl.uniform1i(this.uniform(p, 'uVertexAlpha'), material.vertexAlpha ? 1 : 0);
    gl.uniform1i(this.uniform(p, 'uVertexColor'), material.vertexColor ? 1 : 0);
    gl.uniform1f(this.uniform(p, 'uEmissiveMult'), material.emissiveMult);
    gl.uniform1i(this.uniform(p, 'uOpaque'), material.blend === 'opaque' ? 1 : 0);
    gl.uniform1i(
      this.uniform(p, 'uAdds'),
      material.blend === 'add' || material.blend === 'alphaAdd' ? 1 : 0,
    );
    gl.uniform1i(
      this.uniform(p, 'uEmissiveBlend'),
      { mod: 0, mod2x: 1, add: 2 }[material.emissiveBlend ?? 'add'],
    );
    gl.uniform1f(this.uniform(p, 'uCutout'), material.cutout ?? 0);
  }

  private uniform(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let names = this.uniforms.get(p);
    if (!names) this.uniforms.set(p, (names = new Map()));
    if (!names.has(name)) names.set(name, this.gl.getUniformLocation(p, name));
    return names.get(name)!;
  }

  private texture(image: ImageBitmap): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  private meshVao(mesh: SceneMesh): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attribute = (
      name: string,
      data: ArrayBufferView,
      size: number,
      type: number,
      normalized: boolean,
    ) => {
      const at = gl.getAttribLocation(this.meshProgram, name);
      if (at < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, type, normalized, 0, 0);
    };
    attribute('aPosition', new Float32Array(mesh.positions), 3, gl.FLOAT, false);
    attribute('aUv', new Float32Array(mesh.uvs), 2, gl.FLOAT, false);
    attribute('aUv2', new Float32Array(mesh.uvs2 ?? mesh.uvs), 2, gl.FLOAT, false);
    const normals = mesh.normals
      ? new Float32Array(mesh.normals)
      : new Float32Array(mesh.positions.length); // none: zeros, never read
    attribute('aNormal', normals, 3, gl.FLOAT, false);
    attribute('aColor', new Uint8Array(mesh.colors), 4, gl.UNSIGNED_BYTE, true);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return vao;
  }

  private particleVao(particles: ParticleSystem): [WebGLVertexArrayObject, WebGLBuffer] {
    const gl = this.gl;
    const p = this.particleProgram;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW,
    );
    const corner = gl.getAttribLocation(p, 'aCorner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles.instances.byteLength, gl.DYNAMIC_DRAW);
    const stride = INSTANCE_FLOATS * 4;
    for (const [name, offset] of [
      ['aParticle', 0],
      ['aParticleColor', 16],
    ] as const) {
      const at = gl.getAttribLocation(p, name);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(at, 1);
    }
    gl.bindVertexArray(null);
    return [vao, buffer];
  }
}
