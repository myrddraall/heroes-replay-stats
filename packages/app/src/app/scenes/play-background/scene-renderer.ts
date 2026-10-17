import {
  type LoadedPlayScene,
  layerOffset,
  type LayerChannel,
  type SceneLayer,
  type SceneMaterial,
  type SceneMesh,
} from './play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from './scene-particles';
import {
  type BodyPart,
  type BodyShade,
  DEFAULT_SHADE,
  DEFAULT_STRENGTHS,
  type LoadedPlanet,
  type PlanetLight,
  type PartMapping,
  type PartRole,
} from './scene-planets';
import { BLEND_GLSL, BLEND_MODES, NO_TINTS, PLANETS, type Tints } from './scene-tints';

/** A target's outputs: the colour, the planets' light, their bodies and their glow (COLOR_ATTACHMENT0 to 3). */
const DRAW_BUFFERS = [0x8ce0, 0x8ce1, 0x8ce2, 0x8ce3];

const CHANNELS: Record<LayerChannel, number> = { rgb: 0, rgba: 1, a: 2, r: 3, g: 4, b: 5 };
/** A material's layer slots, in the shader's order, and their samplers. */
const SLOTS = ['uDiffuse', 'uEmissive', 'uMask0', 'uMask1'] as const;
/** How many values a uv sphere's v table has, from the pole to the opposite one (as exported). */
const V_SAMPLES = 32;

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
 * formula alone left it all but invisible (the data doesn't say why); that was measured on the
 * grid's kind of fresnel (type 1); the inverted kind (type 2, the flyby planets' atmospheres and
 * city lights, strongest facing the camera) comes out squared too, without the gain: measured
 * against the tutorial's own shot of Azeroth, whose atmosphere shell (a colour layer and a mask
 * layer, both type 2) falls off from the body's limb as the game shows it only so. A mask layer's
 * fresnel scales its mask as the formula gives it, once. The emissive
 * layer adds to the diffuse colour, or multiplies it (mod, twice for mod2x). A blended material's
 * output is premultiplied; an opaque one's is cut out where its alpha falls below its threshold.
 * A lit material (a flyby planet's) takes its diffuse colour times the light on it: the ambient
 * colour plus each directional light's colour by how squarely the surface faces against the way it
 * travels, as the game's standard material is lit (its specular left out). A material that uses
 * the vertex colour multiplies its diffuse by it.
 */
/** The material shading, shared by the meshes' and the bodies' shaders (each declares the surface inputs). */
const MATERIAL_GLSL = `
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
uniform vec3 uPlanet;
uniform bool uAdds;
uniform float uGlowThreshold, uSceneThreshold, uGlowBoost;
uniform float uStrength;
uniform vec3 uShadeDir;
uniform float uShadeStrength, uShadeSoftness;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outCover;
layout(location = 2) out vec4 outBody;
layout(location = 3) out vec4 outGlow;

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
// The formula's fresnel: from the layer's minimum facing the camera to its maximum edge-on (type
// 1), or the other way about (type 2: the facing itself to the exponent, so a low exponent keeps
// it up nearly to the limb, as the flyby's city lights stay in view in the tutorial's shots).
float fresnelFormula(Layer l) {
  vec3 view = turn(turn(normalize(uEye - vWorld), uUp, l.fTurn.x), uRight, l.fTurn.y);
  float facing = clamp(dot(normalize(vNormal), view), 0.0, 1.0);
  return mix(l.fMin, l.fMax, pow(l.fresnel == 2 ? facing : 1.0 - facing, l.fExponent));
}
// A colour layer's fresnel, as the game shows it: squared, type 1 with the gain.
float fresnel(Layer l) {
  if (l.fresnel == 0) return 1.0;
  float f = fresnelFormula(l);
  return l.fresnel == 2 ? f * f : f * f * FRESNEL_GAIN;
}
vec4 midtone(vec4 v, float m) {
  return m > 0.0 ? pow(v, vec4(1.0 / (1.0 + m))) : v;
}
// A texel at texture coordinates that may wrap (a body's u, round its sphere): the mipmap level
// from the coordinates' change across the pixel, taken where they don't jump (the same
// coordinates wrapped elsewhere change less there), so the wrap leaves no seam.
vec4 sampled(sampler2D tex, vec2 uv) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 elsewhere = fract(uv + 0.5);
  vec2 dxb = dFdx(elsewhere), dyb = dFdy(elsewhere);
  if (dot(dxb, dxb) + dot(dyb, dyb) < dot(dx, dx) + dot(dy, dy)) return textureGrad(tex, uv, dxb, dyb);
  return textureGrad(tex, uv, dx, dy);
}
// A layer's texel; smeared across the mesh's u by uSmear (of the way round the sky: the same
// sweep for every layer whatever its tiling) as the view sweeps in a fly.
vec4 texel(sampler2D tex, Layer l) {
  if (uSmear <= 0.0) return sampled(tex, layerUv(l));
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
  float v = clamp(channel(sampled(tex, layerUv(l)), l.channel).a * l.bright, 0.0, 1.0);
  return midtone(vec4(v), l.midtone).a * (l.fresnel == 0 ? 1.0 : clamp(fresnelFormula(l), 0.0, 1.0));
}
vec3 lit(vec3 albedo) {
  vec3 n = normalize(vNormal);
  vec3 light = uAmbient;
  for (int i = 0; i < 3; i++) {
    if (i < uLightCount) light += uLightColor[i] * max(0.0, dot(n, -normalize(uLightDir[i])));
  }
  return albedo * light * uLightScale;
}
void shade() {
  vec4 diffuse = colorLayer(uDiffuse, uLayers[0]);
  if (uVertexColor) diffuse.rgb *= vColor.rgb;
  vec4 emissive = colorLayer(uEmissive, uLayers[1]);
  vec3 base = uUnshaded ? diffuse.rgb : uLit ? lit(diffuse.rgb) : vec3(0.0);
  // The shade: the body's colour cut where it faces the shade's direction; what it emits isn't.
  if (uShadeStrength > 0.0)
    base *= 1.0 - uShadeStrength * pow(max(0.0, dot(normalize(vNormal), uShadeDir)), uShadeSoftness);
  vec3 glow = emissive.rgb * uEmissiveMult;
  vec3 rgb = uEmissiveBlend == 2 ? base + glow : base * glow * (uEmissiveBlend == 1 ? 2.0 : 1.0);
  float alpha = maskLayer(uMask0, uLayers[2]) * maskLayer(uMask1, uLayers[3]) * diffuse.a;
  if (uVertexAlpha) alpha *= vColor.a;
  if (!uOpaque) alpha *= uStrength; // a part shown less strongly: its blended materials fainter
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
  // What blooms under its own light's threshold that the scene's wouldn't, and its emissive
  // layer's light boosted (a glow as if through haze): the bloom adds them.
  outGlow = vec4(max(outColor.rgb - uGlowThreshold, 0.0) - max(outColor.rgb - uSceneThreshold, 0.0)
    + uGlowBoost * glow * (uOpaque ? 1.0 : alpha), outColor.a);
}
`;

const MESH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vUv2;
in vec3 vNormal;
in vec3 vWorld;
in vec4 vColor;
${MATERIAL_GLSL}
void main() {
  shade();
}`;

/**
 * A planet's part on one square facing the camera, as wide as the body's widest part: the vertex
 * shader puts the square up in the body's frame (x right, y away from the eye, z up, about the
 * body's centre); the fragment shader finds the part's shape under each pixel, in units of the
 * body's radius (the eye and the square's point are given in those), and shades it as the meshes
 * are shaded, with the depth the point has, so parts and bodies hide one another as the meshes
 * did: a sphere by its near side, or its far side (an atmosphere shell modelled inside out, its
 * normals inward: what shows is past the body's limb); a flat ring in the plane facing the eye.
 * The texture coordinates come from the mapping the exporter fitted to the game's mesh (a uv
 * sphere about a pole, linear in the point, or round a ring).
 */
const BODY_VERTEX = `#version 300 es
in vec2 aCorner;
uniform mat4 uViewProjection;
uniform vec3 uCentre;
uniform mat3 uAxes;
uniform float uExtent;
out vec2 vQuad;
void main() {
  vQuad = aCorner * uExtent;
  gl_Position = uViewProjection * vec4(uCentre + uAxes * vec3(vQuad.x, 0.0, vQuad.y), 1.0);
}`;

const BODY_FRAGMENT = `#version 300 es
precision highp float;
vec2 vUv;
vec2 vUv2;
vec3 vNormal;
vec3 vWorld;
vec4 vColor;
${MATERIAL_GLSL}
uniform mat4 uViewProjection;
uniform vec3 uCentre;
uniform mat3 uAxes;
uniform float uRadius;
uniform int uShape;
uniform vec3 uShapeParams, uShapeCentre;
struct Mapping { int kind; vec3 pole; vec3 meridian; vec4 a; vec4 b; float v[${V_SAMPLES}]; };
uniform Mapping uMap, uMap2;
uniform vec4 uPartColor;
in vec2 vQuad;
const float PI = 3.14159265;
// A uv sphere's v at an angle from the pole (0 to 1), between the table's values.
float vAt(float table[${V_SAMPLES}], float polar) {
  float at = clamp(polar, 0.0, 1.0) * float(${V_SAMPLES - 1});
  int k = int(floor(at));
  if (k >= ${V_SAMPLES - 1}) return table[${V_SAMPLES - 1}];
  return mix(table[k], table[k + 1], at - float(k));
}
// A point's texture coordinates by a mapping (the ring's by where it is across the ring too).
vec2 mapped(Mapping m, vec3 p, float across) {
  if (m.kind == 0) {
    vec3 u = normalize(p);
    float polar = acos(clamp(dot(u, m.pole), -1.0, 1.0));
    float az = atan(dot(u, cross(m.pole, m.meridian)), dot(u, m.meridian)) / (2.0 * PI);
    return vec2(fract(m.a.y + (m.a.x > 0.5 ? -az : az)), vAt(m.v, polar / PI));
  }
  if (m.kind == 1) return vec2(dot(m.a, vec4(p, 1.0)), dot(m.b, vec4(p, 1.0)));
  float az = abs(mod(atan(p.z, p.x) - m.a.x + PI, 2.0 * PI) - PI);
  return vec2(m.a.y * (1.0 - az / PI), 1.0 - abs(2.0 * across - 1.0));
}
void main() {
  vec3 eye = uEye;
  vec3 d = normalize(vec3(vQuad.x, 0.0, vQuad.y) / uRadius - eye);
  vec3 p, n;
  if (uShape <= 1) {
    float r = uShapeParams.x;
    vec3 from = eye - uShapeCentre;
    float b = dot(from, d);
    float disc = b * b - dot(from, from) + r * r;
    if (disc < 0.0) discard;
    float t = uShape == 0 ? -b - sqrt(disc) : -b + sqrt(disc);
    if (t <= 0.0) discard;
    p = from + t * d;
    n = p / r * (uShape == 0 ? 1.0 : -1.0);
  } else {
    float t = (uShapeParams.z - eye.y) / d.y;
    if (t <= 0.0) discard;
    p = eye + t * d;
    float rr = length(p.xz);
    if (rr < uShapeParams.x || rr > uShapeParams.y) discard;
    n = vec3(0.0, -1.0, 0.0);
  }
  float across = uShape == 2 ? (length(p.xz) - uShapeParams.x) / max(1e-5, uShapeParams.y - uShapeParams.x) : 0.0;
  vUv = mapped(uMap, p, across);
  vUv2 = mapped(uMap2, p, across);
  vNormal = n;
  vWorld = p;
  vColor = uPartColor;
  if (uShape <= 1) p += uShapeCentre;
  vec4 clip = uViewProjection * vec4(uCentre + uAxes * (p * uRadius), 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  shade();
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
layout(location = 3) out vec4 outGlow;
void main() {
  outCover = vec4(0.0); // the stars are the sky's
  outBody = vec4(0.0);
  outGlow = vec4(0.0);
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
 * The bloom: what is brighter than the light's threshold, channel by channel (so a deep red or
 * blue glow blooms in its colour, as the tutorial's planets' atmospheres do; by luminance they
 * barely would) (uPass 0: taken from the frame, at a
 * fraction of its size, four texels averaged), blurred (uPass 1: nine taps along uStep, run across
 * then down, a few times), for the tone pass to add back over the picture, as the game's HDR spreads
 * what glows (its threshold is the light's; how far and how strongly it spreads aren't in the
 * data: measured against the tutorial's shots of its planets, whose atmospheres bloom well past
 * them).
 */
const BLOOM_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource, uGlow;
uniform vec2 uStep;
uniform float uThreshold;
uniform int uPass;
in vec2 vUv;
out vec4 outColor;
void main() {
  if (uPass == 0) {
    vec3 c = (texture(uSource, vUv + uStep * vec2(-0.5, -0.5)).rgb + texture(uSource, vUv + uStep * vec2(0.5, -0.5)).rgb
      + texture(uSource, vUv + uStep * vec2(-0.5, 0.5)).rgb + texture(uSource, vUv + uStep * vec2(0.5, 0.5)).rgb) * 0.25;
    vec3 g = (texture(uGlow, vUv + uStep * vec2(-0.5, -0.5)).rgb + texture(uGlow, vUv + uStep * vec2(0.5, -0.5)).rgb
      + texture(uGlow, vUv + uStep * vec2(-0.5, 0.5)).rgb + texture(uGlow, vUv + uStep * vec2(0.5, 0.5)).rgb) * 0.25;
    outColor = vec4(max(c - uThreshold, 0.0) + g, 1.0);
  } else {
    float w[5] = float[](0.227, 0.194, 0.121, 0.054, 0.016);
    vec3 sum = texture(uSource, vUv).rgb * w[0];
    for (int i = 1; i < 5; i++) {
      sum += texture(uSource, vUv + uStep * float(i)).rgb * w[i];
      sum += texture(uSource, vUv - uStep * float(i)).rgb * w[i];
    }
    outColor = vec4(sum, 1.0);
  }
}`;
/**
 * How strongly the bloom is added back, how many times it is blurred across and down, how far
 * apart its taps are (in its texels) and how much smaller than the canvas it is: together, how
 * far it spreads (about a tenth of the view's height).
 */
const BLOOM_STRENGTH = 1.5;
const BLOOM_PASSES = 3;
const BLOOM_SPACING = 1.5;
const BLOOM_SCALE = 8;
/** The bloom's threshold where the light doesn't set one: the tutorial's lights' 0.6. */
const DEFAULT_BLOOM_THRESHOLD = 0.6;

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
uniform sampler2D uScene, uCover, uBody, uBloom;
uniform float uExposure, uWhitePoint, uFade, uBloomStrength;
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
  vec3 hdr = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomStrength;
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

/**
 * One material drawn on one mesh, or on one part of a placed planet's body; moving when one of
 * its layers scrolls.
 */
interface MeshDraw {
  readonly vao: WebGLVertexArrayObject;
  readonly count: number;
  readonly material: SceneMaterial;
  readonly moving: boolean;
  /** Which planet it draws (one channel per planet, in PLANETS' order), or none. */
  readonly planet: readonly [number, number, number];
  /** The planet it is part of (a placed one), whose frame places it; none: in world space as it is. */
  readonly placed?: Placed;
  /** The part of the planet's body it is, drawn on the square instead of a mesh. */
  readonly part?: BodyPart;
  /** How it is lit, where it is a lit material of a flyby planet. */
  readonly light?: PlanetLight;
}

/** A planet put up in the scene: where, how big, and which tint channel is its. */
export interface PlanetPlacement {
  readonly planet: LoadedPlanet;
  /** A style it wears: its parts about the body, its light on the body's lit materials. */
  readonly style?: LoadedPlanet;
  /** How much its emissive layers glow past their light: added to the bloom, times this. */
  readonly glow?: number;
  /** How strongly its parts of a role show, 0 to 1 (DEFAULT_STRENGTHS where unsaid): their blended materials' alpha times this. */
  readonly strengths?: Partial<Record<PartRole, number>>;
  /** How strongly its light lights it, times this. */
  readonly lighting?: number;
  /** A shade from a side, over its style's. */
  readonly shade?: Partial<BodyShade>;
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
  /** Which of the tints is its (0 to 2, in PLANETS' order), or none (-1). */
  readonly slot: number;
}

/** A placement with its body's frame as last placed. */
interface Placed {
  placement: PlanetPlacement;
  frame: BodyFrame;
  /** The half-side of the square its parts are drawn on, in the scene's units: its widest part. */
  extent: number;
}

/** A body's frame: its axes in the world (column-major: x, y, z), and the eye in it, in units of its radius. */
export interface BodyFrame {
  readonly axes: Float32Array;
  readonly eye: Vec3;
}

/**
 * A planet's body's frame, as the game's billboards turn to face the eye: about its centre, y
 * away from the eye, z as near up as it can be, x to the right; and the eye in that frame, in
 * units of the body's radius.
 */
export function bodyFrame(position: Vec3, radius: number, eye: Vec3): BodyFrame {
  const y = normalize([position[0] - eye[0], position[1] - eye[1], position[2] - eye[2]]);
  const up: Vec3 = Math.abs(y[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0]; // straight above or below: any way up
  const lean = dot(up, y);
  const z = normalize([up[0] - lean * y[0], up[1] - lean * y[1], up[2] - lean * y[2]]);
  const x = cross(y, z);
  const to: Vec3 = [eye[0] - position[0], eye[1] - position[1], eye[2] - position[2]];
  return {
    axes: new Float32Array([...x, ...y, ...z]),
    eye: [dot(to, x) / radius, dot(to, y) / radius, dot(to, z) / radius],
  };
}

/** A vector in a body's frame (its axes column-major), from the world. */
function intoFrame(axes: Float32Array, v: Vec3): Vec3 {
  return [
    axes[0]! * v[0] + axes[1]! * v[1] + axes[2]! * v[2],
    axes[3]! * v[0] + axes[4]! * v[1] + axes[5]! * v[2],
    axes[6]! * v[0] + axes[7]! * v[1] + axes[8]! * v[2],
  ];
}

/** A placed planet's parts: its body's, and its style's. */
function partsOf(placement: PlanetPlacement): readonly BodyPart[] {
  return [...placement.planet.planet.parts, ...(placement.style?.planet.parts ?? [])];
}

/** How far a body's parts reach from its centre, in units of its radius. */
function reach(parts: readonly BodyPart[]): number {
  return Math.max(
    1,
    ...parts.map((p) =>
      p.shape.kind === 'sphere'
        ? p.shape.radius + Math.hypot(...(p.shape.centre ?? [0, 0, 0]))
        : p.shape.outer,
    ),
  );
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
  /** What blooms under the planets' own lights' thresholds beyond the scene's. */
  glow: WebGLTexture | null;
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
 * Draws the scene into a canvas with WebGL 2: the sky's meshes through the game's camera, the
 * placed planets' bodies each on one camera-facing square (their parts' shapes found under each
 * pixel: no mesh), then the particles as camera-facing squares, into a half-float target (light
 * adds up past white, as in the game's HDR), tone-mapped onto the canvas. Opaque materials (the
 * planets' surfaces) draw first and hide what is behind them; the blended ones follow by
 * priority. What doesn't move (the sky's nebula and stars, the planets) is drawn once per size
 * into a target of its own, colour and depth, and each frame starts from a copy of it, drawing
 * only what moves (the energy's scroll, the particles). Each target also keeps the light each
 * planet gives each pixel, for the planets' own tints.
 */
export class SceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly meshProgram: WebGLProgram;
  private readonly bodyProgram: WebGLProgram;
  /** The square a body's parts are drawn on. */
  private readonly quad: WebGLVertexArrayObject;
  private readonly particleProgram: WebGLProgram;
  private readonly toneProgram: WebGLProgram;
  private readonly bloomProgram: WebGLProgram;
  /** The bloom's two small targets, blurred from one into the other and back. */
  private readonly bloom: { framebuffer: WebGLFramebuffer; texture: WebGLTexture | null }[];
  private bloomSize: [number, number] = [1, 1];
  private readonly textures = new Map<string, WebGLTexture>();
  /** How layers sample their textures, by whether they repeat across u (1) and across v (2). */
  private readonly samplers: WebGLSampler[];
  private readonly vaos: WebGLVertexArrayObject[] = [];
  /** The scene's own draws (its sky), then the placed planets'. */
  private readonly sceneDraws: MeshDraw[] = [];
  private draws: MeshDraw[] = [];
  /** The placed planets whose textures are on the GPU; kept while the renderer lives. */
  private readonly planetsOnGpu = new Set<string>();
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
    this.bodyProgram = program(gl, BODY_VERTEX, BODY_FRAGMENT);
    this.quad = this.quadVao();
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.toneProgram = program(gl, TONE_VERTEX, TONE_FRAGMENT);
    this.bloomProgram = program(gl, TONE_VERTEX, BLOOM_FRAGMENT);
    this.bloom = [0, 1].map(() => ({ framebuffer: gl.createFramebuffer(), texture: null }));
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
      glow: null,
    };
    this.frame = {
      framebuffer: gl.createFramebuffer(),
      depth: gl.createRenderbuffer(),
      texture: null,
      cover: null,
      body: null,
      glow: null,
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
   * The planets put up in the scene, replacing those there were: their textures go to the GPU the
   * first time each planet is placed. What doesn't move is drawn again at the next frame.
   */
  setPlanets(placements: readonly PlanetPlacement[]): void {
    const { eye } = this.loaded.scene.camera;
    this.placed = placements.map((placement) => ({
      placement,
      frame: bodyFrame(placement.position, placement.radius, eye),
      extent: placement.radius * reach(partsOf(placement)),
    }));
    const draws: MeshDraw[] = [];
    for (const placed of this.placed) {
      const { planet, style, slot } = placed.placement;
      const channels = PLANETS.map((_, i) => (i === slot ? 1 : 0)) as [number, number, number];
      for (const loaded of style ? [planet, style] : [planet]) {
        if (this.planetsOnGpu.has(loaded.id)) continue;
        for (const [textureKey, image] of Object.entries(loaded.images))
          if (!this.textures.has(textureKey)) this.textures.set(textureKey, this.texture(image));
        this.planetsOnGpu.add(loaded.id);
      }
      // The body's own parts lit by the style's light where it has one, then the style's parts.
      const light = style?.planet.light ?? planet.planet.light;
      for (const loaded of style ? [planet, style] : [planet]) {
        loaded.planet.parts.forEach((part, i) => {
          for (const m of part.materials) {
            const material = this.material(m, `${loaded.id}/${i}`, loaded.planet.materials);
            draws.push({
              vao: this.quad,
              count: 4,
              material,
              moving: moves(material),
              planet: channels,
              placed,
              part,
              light: material.unshaded ? undefined : light,
            });
          }
        });
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
      placed.frame = bodyFrame(position, radius, eye);
      placed.extent = radius * reach(partsOf(placed.placement));
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
    this.allocateBloom();
    this.stillDirty = true;
  }

  /** The bloom's targets, a quarter of the canvas each way. */
  private allocateBloom(): void {
    const gl = this.gl;
    this.bloomSize = [
      Math.max(1, Math.ceil(this.canvas.width / BLOOM_SCALE)),
      Math.max(1, Math.ceil(this.canvas.height / BLOOM_SCALE)),
    ];
    for (const target of this.bloom) {
      gl.deleteTexture(target.texture);
      target.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, this.format, this.bloomSize[0], this.bloomSize[1]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    }
  }

  /** The bloom of the frame, into the first bloom target. */
  private drawBloom(): void {
    const gl = this.gl;
    const p = this.bloomProgram;
    const [w, h] = this.bloomSize;
    gl.useProgram(p);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindSampler(0, null);
    gl.uniform1i(this.uniform(p, 'uSource'), 0);
    gl.uniform1f(this.uniform(p, 'uThreshold'), this.sceneThreshold());
    // The bright part, from the frame, and the planets' own glow.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom[0]!.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindSampler(1, null);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.glow);
    gl.uniform1i(this.uniform(p, 'uGlow'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uniform(p, 'uPass'), 0);
    gl.uniform2f(this.uniform(p, 'uStep'), 1 / this.canvas.width, 1 / this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Blurred across and down, BLOOM_PASSES times: from one target into the other and back.
    gl.uniform1i(this.uniform(p, 'uPass'), 1);
    for (let i = 0; i < BLOOM_PASSES * 2; i++) {
      const from = this.bloom[i % 2]!;
      const into = this.bloom[(i + 1) % 2]!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
      gl.uniform2f(
        this.uniform(p, 'uStep'),
        i % 2 === 0 ? BLOOM_SPACING / w : 0,
        i % 2 === 0 ? 0 : BLOOM_SPACING / h,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  /** What the scene's light blooms: what is brighter than this. */
  private sceneThreshold(): number {
    return this.loaded.scene.tone.bloomThreshold ?? DEFAULT_BLOOM_THRESHOLD;
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

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.drawBloom();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
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
    gl.activeTexture(gl.TEXTURE3);
    gl.bindSampler(3, null);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom[0]!.texture);
    gl.uniform1i(this.uniform(this.toneProgram, 'uBloom'), 3);
    gl.uniform1f(this.uniform(this.toneProgram, 'uBloomStrength'), BLOOM_STRENGTH);
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
    gl.deleteVertexArray(this.quad);
    for (const p of this.particles) {
      gl.deleteVertexArray(p.vao);
      gl.deleteBuffer(p.buffer);
    }
    for (const p of [
      this.meshProgram,
      this.bodyProgram,
      this.particleProgram,
      this.toneProgram,
      this.bloomProgram,
    ])
      gl.deleteProgram(p);
    for (const target of this.bloom) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    for (const target of [this.still, this.frame]) {
      gl.deleteTexture(target.texture);
      gl.deleteTexture(target.cover);
      gl.deleteTexture(target.body);
      gl.deleteTexture(target.glow);
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
    gl.deleteTexture(target.glow);
    target.glow = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target.glow);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.format, this.canvas.width, this.canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, target.cover, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, target.body, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, target.glow, 0);
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
    const viewProjection = multiply(this.projection, this.view);
    const v = this.view;
    const right: Vec3 = [v[0]!, v[4]!, v[8]!];
    const up: Vec3 = [v[1]!, v[5]!, v[9]!];
    const threshold = this.sceneThreshold();
    gl.useProgram(this.bodyProgram);
    gl.uniformMatrix4fv(this.uniform(this.bodyProgram, 'uViewProjection'), false, viewProjection);
    gl.uniform1f(this.uniform(this.bodyProgram, 'uSmear'), 0);
    gl.uniform1f(this.uniform(this.bodyProgram, 'uSceneThreshold'), threshold);
    gl.useProgram(this.meshProgram);
    gl.uniformMatrix4fv(this.uniform(this.meshProgram, 'uViewProjection'), false, viewProjection);
    gl.uniform1f(this.uniform(this.meshProgram, 'uSceneThreshold'), threshold);
    gl.uniform1f(this.uniform(this.meshProgram, 'uGlowThreshold'), threshold); // the sky: no glow of its own
    gl.uniform1f(this.uniform(this.meshProgram, 'uGlowBoost'), 0);
    gl.uniform1f(this.uniform(this.meshProgram, 'uStrength'), 1);
    gl.uniform1f(this.uniform(this.meshProgram, 'uShadeStrength'), 0);
    gl.uniform3fv(this.uniform(this.meshProgram, 'uEye'), this.loaded.scene.camera.eye);
    gl.uniform3fv(this.uniform(this.meshProgram, 'uRight'), right);
    gl.uniform3fv(this.uniform(this.meshProgram, 'uUp'), up);
    gl.uniform1f(this.uniform(this.meshProgram, 'uSmear'), this.smear);
    gl.uniform1i(this.uniform(this.meshProgram, 'uLit'), 0);
    let program = this.meshProgram;
    for (const draw of this.draws) {
      if (draw.moving !== moving) continue;
      const p = draw.part ? this.bodyProgram : this.meshProgram;
      if (p !== program) gl.useProgram((program = p));
      gl.bindVertexArray(draw.vao);
      this.blend(draw.material);
      this.bindMaterial(p, draw.material, seconds);
      gl.uniform3fv(this.uniform(p, 'uPlanet'), draw.planet);
      if (draw.part && draw.placed) {
        const { placement } = draw.placed;
        const tuning = placement.planet.planet.tuning;
        this.bindPart(draw.part, draw.placed, right, up);
        this.bindLight(draw.light, placement.lighting ?? tuning?.lighting ?? 1);
        this.bindShade(placement);
        // The body glows under its own light's bloom threshold, lit or not (its city lights aren't lit).
        const own = (placement.style ?? placement.planet).planet.light;
        gl.uniform1f(this.uniform(p, 'uGlowThreshold'), own?.bloomThreshold ?? threshold);
        gl.uniform1f(this.uniform(p, 'uGlowBoost'), placement.glow ?? tuning?.glow ?? 0);
        gl.uniform1f(
          this.uniform(p, 'uStrength'),
          placement.strengths?.[draw.part.role] ??
            tuning?.strengths?.[draw.part.role] ??
            DEFAULT_STRENGTHS[draw.part.role] ??
            1,
        );
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, draw.count);
      } else {
        gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, 0);
      }
    }
    gl.bindVertexArray(null);
  }

  /** A body's part and its frame, for the body shader: in units of the body's radius. */
  private bindPart(part: BodyPart, placed: Placed, right: Vec3, up: Vec3): void {
    const gl = this.gl;
    const p = this.bodyProgram;
    const { position, radius } = placed.placement;
    const { axes, eye } = placed.frame;
    gl.uniform3fv(this.uniform(p, 'uCentre'), position);
    gl.uniformMatrix3fv(this.uniform(p, 'uAxes'), false, axes);
    gl.uniform1f(this.uniform(p, 'uRadius'), radius);
    gl.uniform1f(this.uniform(p, 'uExtent'), placed.extent);
    gl.uniform3fv(this.uniform(p, 'uEye'), eye);
    gl.uniform3fv(this.uniform(p, 'uRight'), intoFrame(axes, right));
    gl.uniform3fv(this.uniform(p, 'uUp'), intoFrame(axes, up));
    const { shape, mapping, color } = part;
    if (shape.kind === 'sphere') {
      gl.uniform1i(this.uniform(p, 'uShape'), shape.side === 'near' ? 0 : 1);
      gl.uniform3f(this.uniform(p, 'uShapeParams'), shape.radius, 0, 0);
      gl.uniform3fv(this.uniform(p, 'uShapeCentre'), shape.centre ?? [0, 0, 0]);
    } else {
      gl.uniform1i(this.uniform(p, 'uShape'), 2);
      gl.uniform3f(this.uniform(p, 'uShapeParams'), shape.inner, shape.outer, shape.depth);
    }
    this.bindMapping('uMap', mapping);
    this.bindMapping('uMap2', part.mapping2 ?? mapping);
    const c = color ?? [255, 255, 255, 255];
    gl.uniform4f(this.uniform(p, 'uPartColor'), c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255);
  }

  /** A part's mapping to texture coordinates, for the body shader, into its uniform struct. */
  private bindMapping(name: string, mapping: PartMapping): void {
    const gl = this.gl;
    const at = (field: string) => this.uniform(this.bodyProgram, `${name}.${field}`);
    if (mapping.kind === 'sphere') {
      gl.uniform1i(at('kind'), 0);
      gl.uniform3fv(at('pole'), mapping.pole);
      gl.uniform3fv(at('meridian'), mapping.meridian);
      gl.uniform4f(at('a'), mapping.flip ? 1 : 0, mapping.u0, 0, 0);
      if (mapping.v.length !== V_SAMPLES)
        throw new Error(`a planet's v table has ${mapping.v.length} values, not ${V_SAMPLES}`);
      gl.uniform1fv(at('v[0]'), mapping.v);
    } else if (mapping.kind === 'linear') {
      gl.uniform1i(at('kind'), 1);
      gl.uniform4fv(at('a'), mapping.u);
      gl.uniform4fv(at('b'), mapping.v);
    } else {
      gl.uniform1i(at('kind'), 2);
      gl.uniform4f(at('a'), mapping.from, mapping.uMax, 0, 0);
    }
  }

  /** A placed planet's shade, for the body shader: its own over its style's over the default (none). */
  private bindShade(placement: PlanetPlacement): void {
    const gl = this.gl;
    const p = this.bodyProgram;
    const shade = {
      ...DEFAULT_SHADE,
      ...placement.style?.planet.shade,
      ...placement.planet.planet.tuning?.shade,
      ...placement.shade,
    };
    gl.uniform3fv(this.uniform(p, 'uShadeDir'), normalize(shade.direction));
    gl.uniform1f(this.uniform(p, 'uShadeStrength'), shade.strength);
    gl.uniform1f(this.uniform(p, 'uShadeSoftness'), shade.softness);
  }

  /** How a body's part is lit, for the body shader: not at all, or by its planet's light, times `lighting`. */
  private bindLight(light: PlanetLight | undefined, lighting: number): void {
    const gl = this.gl;
    const p = this.bodyProgram;
    gl.uniform1i(this.uniform(p, 'uLit'), light ? 1 : 0);
    if (!light) return;
    const lights = light.directional.slice(0, 3);
    const pad = Array<number>(9 - lights.length * 3).fill(0);
    gl.uniform3fv(this.uniform(p, 'uAmbient'), light.ambient);
    gl.uniform1i(this.uniform(p, 'uLightCount'), lights.length);
    gl.uniform3fv(this.uniform(p, 'uLightDir'), [...lights.flatMap((l) => [...l.direction]), ...pad]);
    gl.uniform3fv(this.uniform(p, 'uLightColor'), [...lights.flatMap((l) => [...l.color]), ...pad]);
    // The light's exposure over the scene's: the planet as bright as the tutorial shows it.
    gl.uniform1f(
      this.uniform(p, 'uLightScale'),
      (light.exposure / this.loaded.scene.tone.exposure) * lighting,
    );
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

  private bindMaterial(p: WebGLProgram, material: SceneMaterial, seconds: number): void {
    const gl = this.gl;
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

  /** The square a body's parts are drawn on: its corners, -1 to 1, as a strip. */
  private quadVao(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(this.bodyProgram, 'aCorner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
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
