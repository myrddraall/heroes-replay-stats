import {
  type LoadedPlayScene,
  layerOffset,
  type LayerChannel,
  type SceneLayer,
  type SceneMaterial,
  type SceneMesh,
} from './play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from './scene-particles';

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
out vec2 vUv;
out vec2 vUv2;
out vec3 vNormal;
out vec3 vWorld;
out vec4 vColor;
void main() {
  vUv = aUv;
  vUv2 = aUv2;
  vNormal = aNormal;
  vWorld = aPosition;
  vColor = aColor;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
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
 * formula alone left it all but invisible (the data doesn't say why). The emissive
 * layer adds to the diffuse colour, or multiplies it (mod, twice for mod2x). A blended material's
 * output is premultiplied; an opaque one's is cut out where its alpha falls below its threshold.
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
uniform bool uUnshaded, uVertexAlpha, uOpaque;
uniform int uEmissiveBlend;
uniform float uEmissiveMult, uCutout;
uniform vec3 uEye, uRight, uUp;
in vec2 vUv;
in vec2 vUv2;
in vec3 vNormal;
in vec3 vWorld;
in vec4 vColor;
out vec4 outColor;

vec2 layerUv(Layer l) {
  vec2 t = ((l.uvSet == 2 ? vUv2 : vUv) - 0.5 - l.offset) * l.tiling;
  float c = cos(l.angle), s = sin(l.angle);
  return mat2(c, s, -s, c) * t + 0.5;
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
  f = l.fresnel == 2 ? 1.0 - f : f;
  return f * f * FRESNEL_GAIN;
}
vec4 midtone(vec4 v, float m) {
  return m > 0.0 ? pow(v, vec4(1.0 / (1.0 + m))) : v;
}
vec4 colorLayer(sampler2D tex, Layer l) {
  if (!l.used) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 v = l.textured ? midtone(channel(texture(tex, layerUv(l)), l.channel), l.midtone) : l.color;
  return vec4(v.rgb * l.bright * fresnel(l), v.a);
}
float maskLayer(sampler2D tex, Layer l) {
  if (!l.used) return 1.0;
  float v = clamp(channel(texture(tex, layerUv(l)), l.channel).a * l.bright, 0.0, 1.0);
  return midtone(vec4(v), l.midtone).a;
}
void main() {
  vec4 diffuse = colorLayer(uDiffuse, uLayers[0]);
  vec4 emissive = colorLayer(uEmissive, uLayers[1]);
  vec3 base = uUnshaded ? diffuse.rgb : vec3(0.0);
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
}`;

/**
 * A particle as a square facing the camera, its size its side (the brightest stars then come out
 * as wide, and as many, as in a screenshot of the game).
 */
const PARTICLE_VERTEX = `#version 300 es
in vec2 aCorner;
in vec4 aParticle;
in vec4 aParticleColor;
uniform mat4 uView, uProjection;
out vec2 vUv;
out vec4 vColor;
void main() {
  vec4 at = uView * vec4(aParticle.xyz, 1.0);
  at.xy += aCorner * aParticle.w;
  vUv = aCorner + 0.5;
  vColor = aParticleColor;
  gl_Position = uProjection * at;
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform int uChannel;
uniform float uBright;
in vec2 vUv;
in vec4 vColor;
out vec4 outColor;
void main() {
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
 * Then the vs A.I. look, as the game's interface draws it over the screen: the picture multiplied by
 * its texture stretched over the whole of it, by `uShift` of the way (0 none, 1 all).
 */
const TONE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uScene, uShiftTexture;
uniform float uExposure, uWhitePoint, uShift;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(uScene, vUv).rgb * uExposure;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mapped = l * (1.0 + l / (uWhitePoint * uWhitePoint)) / (1.0 + l);
  vec3 shift = texture(uShiftTexture, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  outColor = vec4((l > 0.0 ? c * (mapped / l) : c) * mix(vec3(1.0), shift, uShift), 1.0);
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
}

/** A float render target (half floats where the browser can render to them), with depth. */
interface Target {
  readonly framebuffer: WebGLFramebuffer;
  readonly depth: WebGLRenderbuffer;
  texture: WebGLTexture | null;
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
 */
export class SceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly meshProgram: WebGLProgram;
  private readonly particleProgram: WebGLProgram;
  private readonly toneProgram: WebGLProgram;
  private readonly textures = new Map<string, WebGLTexture>();
  private readonly vaos: WebGLVertexArrayObject[] = [];
  private readonly draws: MeshDraw[] = [];
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
    this.format = gl.getExtension('EXT_color_buffer_float') !== null ? gl.RGBA16F : gl.RGBA8;
    this.still = {
      framebuffer: gl.createFramebuffer(),
      depth: gl.createRenderbuffer(),
      texture: null,
    };
    this.frame = {
      framebuffer: gl.createFramebuffer(),
      depth: gl.createRenderbuffer(),
      texture: null,
    };
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    for (const [key, image] of Object.entries(loaded.images))
      this.textures.set(key, this.texture(image));
    const { scene } = loaded;
    for (const [name, mesh] of Object.entries(scene.meshes)) {
      if (!mesh.materials.length) continue; // an emitter, not drawn
      const vao = this.meshVao(mesh);
      this.vaos.push(vao);
      for (const m of mesh.materials) {
        const material = this.material(m, name);
        this.draws.push({ vao, count: mesh.indices.length, material, moving: moves(material) });
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
        material: this.material(system.material, 'particles'),
      });
    }
    // Opaque draws first (they write depth), then the blended ones by the model's priority, highest
    // first, as the game draws a model's materials (the order of equal ones is the scene's).
    this.draws.sort(
      (a, b) =>
        Number(a.material.blend !== 'opaque') - Number(b.material.blend !== 'opaque') ||
        (b.material.priority ?? 0) - (a.material.priority ?? 0),
    );
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
  }

  /**
   * The drawing buffer's size, in device pixels; the camera keeps its vertical field of view. What
   * doesn't move is drawn again at the new size.
   */
  resize(width: number, height: number): void {
    const gl = this.gl;
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    const { camera } = this.loaded.scene;
    this.view = viewMatrix(camera.eye, camera.forward, camera.up);
    this.projection = projectionMatrix(
      camera.fovY,
      this.canvas.width / this.canvas.height,
      camera.near,
      camera.far,
    );
    this.allocate(this.still);
    this.allocate(this.frame);
    this.begin(this.still);
    this.drawMeshes(false, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** How far the vs A.I. look is in, from 0 (not at all) to 1 (fully); applies from the next draw. */
  versusAI = 0;

  /** The scene at `seconds` on its clock. */
  draw(seconds: number): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.still.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.frame.framebuffer);
    gl.blitFramebuffer(
      0,
      0,
      width,
      height,
      0,
      0,
      width,
      height,
      gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
      gl.NEAREST,
    );
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
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uView'), false, this.view);
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uProjection'), false, this.projection);
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
    gl.bindTexture(gl.TEXTURE_2D, this.textures.get(this.loaded.scene.versusAI.multiply)!);
    gl.uniform1i(this.uniform(this.toneProgram, 'uShiftTexture'), 1);
    gl.uniform1f(this.uniform(this.toneProgram, 'uShift'), this.versusAI);
    gl.uniform1f(this.uniform(this.toneProgram, 'uExposure'), this.loaded.scene.tone.exposure);
    gl.uniform1f(this.uniform(this.toneProgram, 'uWhitePoint'), this.loaded.scene.tone.whitePoint);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Free what the GPU holds; the context goes with the canvas anyway. */
  dispose(): void {
    const gl = this.gl;
    for (const t of this.textures.values()) gl.deleteTexture(t);
    for (const vao of this.vaos) gl.deleteVertexArray(vao);
    for (const p of this.particles) {
      gl.deleteVertexArray(p.vao);
      gl.deleteBuffer(p.buffer);
    }
    for (const p of [this.meshProgram, this.particleProgram, this.toneProgram]) gl.deleteProgram(p);
    for (const target of [this.still, this.frame]) {
      gl.deleteTexture(target.texture);
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
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
    for (const draw of this.draws) {
      if (draw.moving !== moving) continue;
      gl.bindVertexArray(draw.vao);
      this.blend(draw.material);
      this.bindMaterial(draw.material, seconds);
      gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  private material(name: string, where: string): SceneMaterial {
    const material = this.loaded.scene.materials[name];
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
    gl.uniform1f(this.uniform(p, 'uEmissiveMult'), material.emissiveMult);
    gl.uniform1i(this.uniform(p, 'uOpaque'), material.blend === 'opaque' ? 1 : 0);
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
