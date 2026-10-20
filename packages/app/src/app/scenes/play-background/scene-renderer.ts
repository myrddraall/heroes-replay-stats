import {
  type LoadedPlayScene,
  layerOffset,
  type LayerChannel,
  type SceneBlend,
  type SceneLayer,
  type SceneMaterial,
  type SceneMesh,
} from './play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from './scene-particles';
import { DEFAULT_ACTIVE, MATERIAL_DEFAULTS, mergeMaterialSettings } from './material-settings';
import { rimTurn } from './scene-directions';
import { skyDepths } from './sky-depths';
import {
  type AddedLight,
  addedShades,
  dataActivation,
  dataReveal,
  revealFrom,
  type FieldLight,
  fieldLights,
  type LightSettingsMap,
  linkedSettings,
  rgbOf,
  withAddedLights,
  withLightSettings,
  tunedRig,
  withShadowSettings,
} from './scene-lights';
import {
  type BodyPart,
  type BodyShade,
  drawOrder,
  DEFAULT_SHADE,
  type LoadedPlanet,
  type MaterialDepth,
  type MaterialSettings,
  type MaterialSettingsMap,
  type MaterialTint,
  type SkySettings,
  type PlanetLight,
  type PartMapping,
  wearOf,
  partKey,
  type PartKey,
  type PartSettingsMap,
  withLayers,
  withPart,
  withMasks,
  wornParts,
} from './scene-planets';
import {
  BLEND_GLSL,
  BLEND_MODES,
  NO_TINT,
  parseCanvasColour,
  type Tint,
  TINT_GLSL,
} from './scene-tints';

/** How many directional lights, and how many shades (shadows), a body is drawn with at most. */
const MAX_LIGHTS = 8;
const MAX_SHADES = 4;
/** How many reveal lights, and how many activation lights, a grid is drawn with at most. */
const MAX_FIELDS = 4;
/** A target's outputs: the colour and the glow (COLOR_ATTACHMENT0 and 1). */
const DRAW_BUFFERS = [0x8ce0, 0x8ce1];

const CHANNELS: Record<LayerChannel, number> = { rgb: 0, rgba: 1, a: 2, r: 3, g: 4, b: 5 };
/** A material's layer slots, in the shader's order, and their samplers. */
const SLOTS = ['uDiffuse', 'uEmissive', 'uMask0', 'uMask1'] as const;
/** How many values a uv sphere's v table has, from the pole to the opposite one (as exported). */
const V_SAMPLES = 32;
/** How many hexes a drawn hex pattern has round a body at scale 1, where it doesn't say how many its texture has. */
const HEX_ROUND = 24;

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
 * A mask at its full offset (1) cuts nothing out of an opaque material: the Play screen planets'
 * birth masks run from 0 (their hex dissolve, cut at half) to 1 as they are born and rest there,
 * born whole (as the game shows them), while what they fade (the birth glow) keeps its curve.
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
#define MAX_LIGHTS ${MAX_LIGHTS}
#define MAX_SHADES ${MAX_SHADES}
#define MAX_FIELDS ${MAX_FIELDS}
uniform bool uUnshaded, uVertexAlpha, uVertexColor, uOpaque;
uniform int uEmissiveBlend;
uniform float uEmissiveMult, uCutout;
uniform float uSmear;
uniform bool uLit;
uniform vec3 uAmbient;
uniform vec3 uLightDir[MAX_LIGHTS];
uniform vec3 uLightColor[MAX_LIGHTS];
uniform int uLightCount;
uniform float uLightScale;
uniform vec3 uEye, uRight, uUp;
uniform float uGlowThreshold, uSceneThreshold, uGlowBoost;
uniform float uStrength, uSpread, uCut, uFalloff;
uniform int uPattern;
uniform vec3 uPatternParams;
uniform vec3 uShadeDir[MAX_SHADES];
uniform float uShadeStrength[MAX_SHADES], uShadeSoftness[MAX_SHADES];
uniform int uShadeCount;
// A grid's: shown where its reveal lights reach (its emissive times how much), coloured from
// inactive (its diffuse) to uActiveColor where its activation lights reach; each light its side
// (body frame), spread, falloff and strength, an activation's how much it energizes (reveals too).
uniform bool uRevealed;
uniform int uRevealCount, uActivationCount;
uniform vec3 uRevealFrom[MAX_FIELDS];
uniform float uRevealSpread[MAX_FIELDS], uRevealFalloff[MAX_FIELDS], uRevealStrength[MAX_FIELDS];
uniform vec3 uActivationFrom[MAX_FIELDS];
uniform float uActivationSpread[MAX_FIELDS], uActivationFalloff[MAX_FIELDS], uActivationStrength[MAX_FIELDS];
uniform float uActivationEnergy[MAX_FIELDS], uActivationGlow[MAX_FIELDS];
uniform vec3 uActiveColor;
uniform vec2 uRimTurn;
uniform vec3 uTintColor, uBodyTintColor;
uniform int uTintBlend, uBodyTintBlend;
uniform float uTintStrength, uBodyTintStrength;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlow;
// How much of the pixel the shape covers (a body's edge, smoothed; a mesh's: all of it).
float coverage = 1.0;
// Whether the pixel is past a sphere's outline (in its smoothed edge): its textures are seen
// wholly edge-on there, so read at their coarsest (the point it takes, the outline's, is the
// same for its neighbours, which would otherwise read them sharpest and alias).
bool pastOutline = false;
${BLEND_GLSL}
${TINT_GLSL}
// The material's own tint, then its body's over all its materials (a planet's; the sky's over the sky's).
vec3 tinted(vec3 c) {
  return tintBy(tintBy(c, uTintColor, uTintBlend, uTintStrength), uBodyTintColor, uBodyTintBlend, uBodyTintStrength);
}

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
float fresnelWith(Layer l, vec2 lean, float spread) {
  // The turn (the layer's own, or a reveal light's), and its planet's lean of its rims and glows.
  vec2 t = lean + uRimTurn;
  vec3 view = turn(turn(normalize(uEye - vWorld), uUp, t.x), uRight, t.y);
  float facing = clamp(dot(normalize(vNormal), view), 0.0, 1.0);
  // Spread: in place of the layer's minimum (none set: as the layer has it), so what shows at
  // the limb shows across the face; 0 is nothing but the limb.
  float low = spread < 0.0 ? l.fMin : spread * l.fMax;
  return mix(low, l.fMax, pow(l.fresnel == 2 ? facing : 1.0 - facing, l.fExponent));
}
float fresnelFormula(Layer l) {
  return fresnelWith(l, l.fTurn, uSpread);
}
// A colour layer's fresnel as the game shows it (squared, type 1 with the gain), to a falloff.
float fresnelTo(Layer l, vec2 lean, float spread, float falloff) {
  float f = fresnelWith(l, lean, spread);
  return l.fresnel == 2 ? f * f : pow(f, falloff) * FRESNEL_GAIN;
}
// How much a grid's light reaches here, 0 to 1: as a light does, the more the face turns to its
// side (any side, the far one too), wrapped round by its spread (0: the half facing it; 1: on round
// to the point facing away, fading all the way) and sharpened by its falloff. Times its strength
// (more than 1 reaches further fully), what it reaches never comes out even: its side and its
// falloff always tell.
float fieldAt(vec3 from, float spread, float falloff) {
  float facing = dot(normalize(vNormal), normalize(from));
  return pow(clamp((facing + spread) / (1.0 + spread), 0.0, 1.0), falloff);
}
float activationAt(int i) {
  return fieldAt(uActivationFrom[i], uActivationSpread[i], uActivationFalloff[i]);
}
// How active a grid is here: its activation lights added up (up to 1), each times its strength.
float activation() {
  float a = 0.0;
  for (int i = 0; i < MAX_FIELDS; i++) {
    if (i >= uActivationCount) break;
    a += uActivationStrength[i] * activationAt(i);
  }
  return min(a, 1.0);
}
// How much brighter a grid shines here, and blooms: what its glowing activation lights activate,
// times how much each glows.
float activeGlow() {
  float g = 0.0;
  for (int i = 0; i < MAX_FIELDS; i++) {
    if (i >= uActivationCount) break;
    g += uActivationGlow[i] * min(uActivationStrength[i] * activationAt(i), 1.0);
  }
  return g;
}
// How much of a grid shows here, 0 to 1: its reveal lights added up, and what its energizing
// activation lights reveal too (as much as they activate, times how much each energizes).
float revealed() {
  float sum = 0.0;
  for (int i = 0; i < MAX_FIELDS; i++)
    if (i < uRevealCount)
      sum += uRevealStrength[i] * fieldAt(uRevealFrom[i], uRevealSpread[i], uRevealFalloff[i]);
  for (int i = 0; i < MAX_FIELDS; i++)
    if (i < uActivationCount)
      sum += uActivationEnergy[i] * uActivationStrength[i] * activationAt(i);
  return min(sum, 1.0);
}
// A colour layer's fresnel, its own: to the material's falloff (2, as measured on the planets'
// grid, unless set).
float fresnel(Layer l) {
  if (l.fresnel == 0) return 1.0;
  return fresnelTo(l, l.fTurn, uSpread, uFalloff);
}
vec4 midtone(vec4 v, float m) {
  return m > 0.0 ? pow(v, vec4(1.0 / (1.0 + m))) : v;
}
// A texel at texture coordinates that may wrap (a body's u, round its sphere): the mipmap level
// from the coordinates' change across the pixel, taken where they don't jump (the same
// coordinates wrapped elsewhere change less there), so the wrap leaves no seam.
vec4 sampled(sampler2D tex, vec2 uv) {
  if (pastOutline) return textureGrad(tex, uv, vec2(1.0, 0.0), vec2(0.0, 1.0));
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
// A hex grid's lines, drawn: the distance from the nearest cell's edge in a grid of pointy
// hexes a unit apart, the lines "width" of a cell wide (anti-aliased by the pixel's footprint)
// and glowing "soft" about themselves.
float hexLines(vec2 p, float width, float soft) {
  const vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 c = abs(dot(a, a) < dot(b, b) ? a : b);
  float edge = 0.5 - max(dot(c, normalize(vec2(1.0, 1.7320508))), c.x);
  float aa = fwidth(edge);
  float line = 1.0 - smoothstep(width - aa, width + aa, edge);
  float halo = soft * exp(-max(edge - width, 0.0) * 6.0);
  return max(line, halo);
}
// The emissive layer drawn as a pattern instead of read from its texture: the hexes on the
// mapping, so many round it (the params: round, width, soft), regular at the equator.
vec4 patternLayer(Layer l) {
  if (!l.used) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 p = vec2(vUv.x, vUv.y * 0.5) * uPatternParams.x;
  float v = hexLines(p, uPatternParams.y, uPatternParams.z);
  return vec4(vec3(v) * l.bright * fresnel(l), 1.0);
}
float maskLayer(sampler2D tex, Layer l) {
  if (!l.used) return 1.0;
  if (uOpaque && l.midtone >= 1.0) return 1.0; // fully born: nothing cut out
  float v = clamp(channel(sampled(tex, layerUv(l)), l.channel).a * l.bright, 0.0, 1.0);
  return midtone(vec4(v), l.midtone).a * (l.fresnel == 0 ? 1.0 : clamp(fresnelFormula(l), 0.0, 1.0));
}
vec3 lit(vec3 albedo) {
  vec3 n = normalize(vNormal);
  vec3 light = uAmbient;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i < uLightCount) light += uLightColor[i] * max(0.0, dot(n, -normalize(uLightDir[i])));
  }
  return albedo * light * uLightScale;
}
void shade() {
  vec4 diffuse = colorLayer(uDiffuse, uLayers[0]);
  if (uVertexColor) diffuse.rgb *= vColor.rgb;
  // A grid's colour, from inactive (its own) towards active where its activation lights reach.
  if (uActivationCount > 0) diffuse.rgb = mix(diffuse.rgb, uActiveColor * uLayers[0].bright, activation());
  vec4 emissive = uPattern == 1 ? patternLayer(uLayers[1]) : colorLayer(uEmissive, uLayers[1]);
  // A grid shows where its reveal lights reach it (with its own fade, the game's look).
  if (uRevealed) emissive.rgb *= revealed();
  vec3 base = uUnshaded ? diffuse.rgb : uLit ? lit(diffuse.rgb) : vec3(0.0);
  // The shades (its shadows): the body's colour cut where it faces each one's direction; what it
  // emits isn't.
  for (int i = 0; i < MAX_SHADES; i++) {
    if (i < uShadeCount && uShadeStrength[i] > 0.0)
      base *= 1.0 - uShadeStrength[i] * pow(max(0.0, dot(normalize(vNormal), uShadeDir[i])), uShadeSoftness[i]);
  }
  vec3 glow = emissive.rgb * uEmissiveMult;
  // The emissive pattern cut: what is below the cut goes black, the rest keeps its range.
  if (uCut > 0.0) glow = max(glow - uCut, 0.0) / (1.0 - uCut);
  // A grid shines brighter, and blooms more, where its glowing activation lights activate it.
  float shining = uActivationCount > 0 ? activeGlow() : 0.0;
  glow *= 1.0 + shining;
  vec3 rgb = tinted(uEmissiveBlend == 2 ? base + glow : base * glow * (uEmissiveBlend == 1 ? 2.0 : 1.0));
  float alpha = maskLayer(uMask0, uLayers[2]) * maskLayer(uMask1, uLayers[3]) * diffuse.a;
  if (uVertexAlpha) alpha *= vColor.a;
  if (!uOpaque) alpha *= uStrength; // a part shown less strongly: its blended materials fainter
  if (uOpaque) {
    if (alpha < uCutout) discard;
    // Opaque, but for its edge: blended there by how much of the pixel it covers.
    outColor = vec4(rgb * coverage, coverage);
  } else {
    alpha *= coverage;
    outColor = vec4(rgb * alpha, alpha);
  }
  // What blooms under its own light's threshold that the scene's wouldn't (the glow up to 1 of
  // it: 0 none, 1 as the data has it), and past 1 its emissive light boosted (a glow as if
  // through haze): the bloom adds them. Below 1 the glow also takes back as much of what the
  // scene's own bloom would make of this light, so at 0 it glows not at all. The light is the
  // emissive layer's, or the colour it modulates (a grid over a colour glows in that colour).
  vec3 shine = uEmissiveBlend == 2 ? tinted(glow) : rgb;
  float up = min(uGlowBoost, 1.0);
  outGlow = vec4(up * max(outColor.rgb - uGlowThreshold, 0.0) - max(outColor.rgb - uSceneThreshold, 0.0)
    + (max(uGlowBoost - 1.0, 0.0) + shining) * shine * (uOpaque ? coverage : alpha), outColor.a);
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
const int RING_SAMPLES = 4;
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
  // v: nothing at both edges, all at the circle a.z of the way across (as the mesh has it).
  float mid = clamp(m.a.z, 0.001, 0.999);
  return vec2(m.a.y * (1.0 - az / PI), across < mid ? across / mid : (1.0 - across) / (1.0 - mid));
}
void main() {
  vec3 eye = uEye;
  vec3 d = normalize(vec3(vQuad.x, 0.0, vQuad.y) / uRadius - eye);
  vec3 p, n;
  // Each shape's edge smoothed over a pixel: how far inside it the pixel is, over how much that
  // changes across the pixel (worked out for every pixel of the square, before any is dropped).
  float r = uShapeParams.x;
  vec3 from = eye - uShapeCentre;
  float b = dot(from, d);
  float disc = b * b - dot(from, from) + r * r;
  float tRing = (uShapeParams.z - eye.y) / d.y;
  float rr = length((eye + tRing * d).xz);
  float inside = uShape <= 1 ? disc : min(rr - uShapeParams.x, uShapeParams.y - rr);
  coverage = clamp(inside / max(fwidth(inside), 1e-6) + 0.5, 0.0, 1.0);
  // A pixel the shape misses isn't dropped (its neighbours' texture derivatives need it: a
  // dropped one leaves them undefined, and the textures alias along the edge); it is shaded as
  // the edge and given nothing, below.
  if (uShape <= 1) {
    // Past the edge but within the pixel: the edge itself.
    pastOutline = disc < 0.0;
    float t = uShape == 0 ? -b - sqrt(max(disc, 0.0)) : -b + sqrt(max(disc, 0.0));
    if (t <= 0.0) discard;
    p = from + t * d;
    n = p / r * (uShape == 0 ? 1.0 : -1.0);
  } else {
    if (tRing <= 0.0) discard;
    p = eye + tRing * d;
    n = vec3(0.0, -1.0, 0.0);
  }
  float across = uShape == 2 ? (length(p.xz) - uShapeParams.x) / max(1e-5, uShapeParams.y - uShapeParams.x) : 0.0;
  vNormal = n;
  vWorld = p;
  vColor = uPartColor;
  vec3 at = uShape <= 1 ? p + uShapeCentre : p;
  vec4 clip = uViewProjection * vec4(uCentre + uAxes * (at * uRadius), 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  if (uShape == 2) {
    // A ring is brightest along one circle (its v's peak: a crease a pixel or so wide when
    // small): shaded at RING_SAMPLES points across the pixel's width of it, and averaged, so the
    // line is as smooth as the game's drawn larger and scaled down, not a staircase.
    float width = fwidth(across);
    vec4 colour = vec4(0.0), glow = vec4(0.0);
    for (int i = 0; i < RING_SAMPLES; i++) {
      float a = clamp(across + width * ((float(i) + 0.5) / float(RING_SAMPLES) - 0.5), 0.0, 1.0);
      vUv = mapped(uMap, p, a);
      vUv2 = mapped(uMap2, p, a);
      shade();
      colour += outColor;
      glow += outGlow;
    }
    outColor = colour / float(RING_SAMPLES);
    outGlow = glow / float(RING_SAMPLES);
  } else {
    vUv = mapped(uMap, p, across);
    vUv2 = mapped(uMap2, p, across);
    shade();
  }
  if (coverage <= 0.0) {
    // Missed: nothing drawn, nothing hidden.
    outColor = vec4(0.0);
    outGlow = vec4(0.0);
    gl_FragDepth = 1.0;
  }
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
// The sky's tint: the stars are the sky's.
uniform vec3 uBodyTintColor;
uniform int uBodyTintBlend;
uniform float uBodyTintStrength;
in vec2 vUv;
in vec4 vColor;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlow;
${BLEND_GLSL}
${TINT_GLSL}
void main() {
  outGlow = vec4(0.0);
  vec4 t = texture(uTexture, vUv);
  vec3 c = uChannel <= 1 ? t.rgb : vec3(uChannel == 2 ? t.a : uChannel == 3 ? t.r : uChannel == 4 ? t.g : t.b);
  vec3 star = tintBy(c * uBright * vColor.rgb, uBodyTintColor, uBodyTintBlend, uBodyTintStrength);
  outColor = vec4(star * vColor.a, 0.0);
}`;

const TONE_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * A layer drawn on its own (premultiplied: its alpha what it covers), over the frame: its colour
 * and its glow, each covering what is under it as far as the layer's alpha says.
 */
const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uColor, uGlow;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlow;
void main() {
  outColor = texture(uColor, vUv);
  outGlow = vec4(texture(uGlow, vUv).rgb, outColor.a);
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
 * Then the tint, as CSS blends a colour over the picture: fading from the tint before (uTint[1])
 * to the tint now (uTint[0]) by uFade.
 */
const TONE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom;
uniform float uExposure, uWhitePoint, uFade, uBloomStrength;
uniform vec3 uTint[2];
uniform int uBlend[2];
// An editing backdrop in place of the sky (0: none; 1: a colour; 2: a grid of two, uGridSize
// pixels a square), under what the scene covers (its alpha), as it is: not tone-mapped or tinted.
uniform int uBackdrop;
uniform vec3 uBackdropA, uBackdropB;
uniform float uGridSize;
in vec2 vUv;
out vec4 outColor;
${BLEND_GLSL}
void main() {
  vec4 scene = texture(uScene, vUv);
  vec3 hdr = scene.rgb + texture(uBloom, vUv).rgb * uBloomStrength;
  float light = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = hdr * uExposure;
  float l = light * uExposure;
  float mapped = l * (1.0 + l / (uWhitePoint * uWhitePoint)) / (1.0 + l);
  c = clamp(l > 0.0 ? c * (mapped / l) : c, 0.0, 1.0);
  vec3 shown = mix(blend(c, uTint[1], uBlend[1]), blend(c, uTint[0], uBlend[0]), uFade);
  if (uBackdrop > 0) {
    vec2 cell = floor(gl_FragCoord.xy / uGridSize);
    vec3 back = uBackdrop == 2 && mod(cell.x + cell.y, 2.0) >= 1.0 ? uBackdropB : uBackdropA;
    shown = clamp(shown + back * (1.0 - clamp(scene.a, 0.0, 1.0)), 0.0, 1.0);
  }
  outColor = vec4(shown, 1.0);
}`;

/**
 * An editing aid in place of the sky (none of the sky, its stars or particles drawn): a plain
 * colour, or a grid of two as image editors show transparency, its squares `size` CSS pixels.
 * Colours are 0 to 1, shown as they are.
 */
export type Backdrop =
  | { readonly kind: 'colour'; readonly colour: Vec3 }
  | { readonly kind: 'grid'; readonly size: number; readonly colours: readonly [Vec3, Vec3] };

type Vec3 = readonly [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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

/**
 * A perspective projection (column-major) with a vertical field of view in degrees; its far plane
 * may be infinitely far (nothing however far is cut off).
 */
export function projectionMatrix(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const t = 1 / Math.tan((fovY * Math.PI) / 360);
  const infinite = !Number.isFinite(far);
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
    infinite ? -1 : (far + near) / (near - far),
    -1,
    0,
    0,
    infinite ? -2 * near : (2 * far * near) / (near - far),
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
/**
 * Draws in the order they are drawn: each owner's (the sky's, each placed planet's) by its
 * materials' draw order (`drawOrder`, with the order `orderOf` gives it, where set); all the opaque
 * first, then the rest by their places in their owners' orders.
 */
function sorted<T extends { readonly draw: MeshDraw; readonly blend: SceneBlend }>(
  draws: readonly T[],
  orderOf: (placed: Placed | undefined) => readonly string[] | undefined,
): T[] {
  const owners = new Map<Placed | undefined, T[]>();
  for (const d of draws) owners.set(d.draw.placed, [...(owners.get(d.draw.placed) ?? []), d]);
  const rank = new Map<T, number>();
  for (const [placed, list] of owners) {
    const names = drawOrder(
      list.map((d) => ({ name: d.draw.name, blend: d.blend, priority: d.draw.material.priority })),
      orderOf(placed),
    );
    for (const d of list) rank.set(d, names.indexOf(d.draw.name));
  }
  return [...draws].sort(
    (a, b) =>
      Number(a.blend !== 'opaque') - Number(b.blend !== 'opaque') || rank.get(a)! - rank.get(b)!,
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
  /** The material's name, which its settings are kept by. */
  readonly name: string;
  readonly material: SceneMaterial;
  readonly moving: boolean;
  /** The planet it is part of (a placed one), whose frame places it; none: in world space as it is. */
  readonly placed?: Placed;
  /** The planet or style the material is of, whose tuning is its settings' default; none: the sky's. */
  readonly owner?: LoadedPlanet;
  /** The part of the planet's body it is, drawn on the square instead of a mesh. */
  readonly part?: BodyPart;
  /** That part by whose it is and its role, for its settings. */
  readonly partKey?: PartKey;
  /** How it is lit, where it is a lit material of a flyby planet. */
  readonly light?: PlanetLight;
}

/** A planet put up in the scene: where, how big, and which tint channel is its. */
export interface PlanetPlacement {
  readonly planet: LoadedPlanet;
  /** A style it wears: its parts about the body, its light on the body's lit materials. */
  readonly style?: LoadedPlanet;
  /** Not drawn (nor picked), though where it is: switched off. */
  readonly hidden?: boolean;
  /** Its materials' settings (its own and its style's, by name), over the tunings' (the planet's for its materials, the style's for its own). */
  readonly materials?: MaterialSettingsMap;
  /** Its parts' shapes and mappings, by part, in place of their own. */
  readonly parts?: PartSettingsMap;
  /** Its materials' draw order, by name (its own and its style's), where set (see `drawOrder`). */
  readonly order?: readonly string[];
  /** Its lights' settings, by light, over its rig's and its shade (see `scene-lights.ts`). */
  readonly lights?: LightSettingsMap;
  /** Lights added to it (its own and its overlay's), after its rig's. */
  readonly added?: readonly AddedLight[];
  /** A tint over all its materials (its style's too), over its tuning's. */
  readonly tint?: MaterialTint;
  /**
   * Its rig turned and made stronger together (`tunedRig`), over its tuning's: kept from before
   * lights were objects (each light's own settings now), no longer set.
   */
  readonly lightFrom?: Vec3;
  /** Where its rims and glows lean (a point on its face), over its tuning's; none: as the data has them. */
  readonly rim?: Vec3;
  /** (See `lightFrom`.) */
  readonly lighting?: number;
  /** A shade from a side, over its style's. */
  readonly shade?: Partial<BodyShade>;
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
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

/**
 * How big a flat ring at `depth` (towards the eye, negative) must be to lie on a body's limb seen
 * from `distance` (both in the body's radii), but for a factor: the limb's tangent (1 over the
 * root of distance² - 1) times the ring's distance from the eye. A ring modelled to lie on the
 * limb from one distance keeps to it from another, scaled by the ratio of the two.
 */
const ringFit = (distance: number, depth: number) =>
  Number.isFinite(distance)
    ? (distance + depth) / Math.sqrt(Math.max(distance * distance - 1, 1e-6))
    : 1; // from afar: the limb as far as the ring

/** How much bigger a ring is drawn seen from `distance` (the body's radii) than as modelled. */
const ringScale = (shape: { readonly depth: number; readonly seen?: number }, distance: number) =>
  shape.seen ? ringFit(distance, shape.depth) / ringFit(shape.seen, shape.depth) : 1;

/** Whether a draw is shown: its body and its part switched on (the sky's always are). */
function shown(draw: MeshDraw): boolean {
  const placement = draw.placed?.placement;
  if (!placement) return true;
  return !placement.hidden && !(draw.partKey && placement.parts?.[draw.partKey]?.enabled === false);
}

/** The id of the style a placed planet wears, if any. */
const styleIdOf = (placement: PlanetPlacement) => placement.style?.id.replace(/^style-/, '');

/** How a placed planet wears its style (its tuning's say), if it wears one. */
const wearIn = (placement: PlanetPlacement) =>
  wearOf(placement.planet.planet, styleIdOf(placement));

/** A placed planet's style's parts, as it wears them. */
const styleParts = (placement: PlanetPlacement): readonly BodyPart[] =>
  placement.style
    ? wornParts(placement.planet.planet, styleIdOf(placement), placement.style.planet.parts)
    : [];

/** A placed planet's parts: its body's, and its style's as it wears them; each as set. */
function partsOf(placement: PlanetPlacement): readonly BodyPart[] {
  const set = (from: 'own' | 'style') => (p: BodyPart) =>
    withPart(p, placement.parts?.[partKey(from, p.role)]);
  return [
    ...placement.planet.planet.parts.map(set('own')),
    ...styleParts(placement).map(set('style')),
  ];
}

/**
 * The half-side of the square a body's parts are drawn on, in the scene's units: as far as they
 * reach, widened for perspective. A sphere seen from a finite distance shows wider than its radius
 * on the plane through its centre (its outline is where the eye's rays graze it, nearer the eye):
 * by d/sqrt(d^2 - r^2) for a sphere of radius r at distance d; a square only as wide as the radius
 * cuts its edges off, the more so the nearer and larger the body.
 */
export function bodyExtent(radius: number, reachOf: number, eyeDistance: number): number {
  const r = radius * reachOf;
  const d = Math.max(eyeDistance, r * 1.01); // the eye inside it: as wide as it can usefully be
  return (r * d) / Math.sqrt(d * d - r * r);
}

/**
 * The half-side of the square a body's parts are drawn on (see `bodyExtent`), from all of them:
 * its spheres widened for perspective, and its rings (flat, facing the eye, `depth` from its
 * centre: one nearer the eye shows wider on the square, by d over its plane's distance), sized
 * as seen from there.
 */
export function partsExtent(
  radius: number,
  parts: readonly BodyPart[],
  eyeDistance: number,
): number {
  const d = eyeDistance / radius;
  let out = bodyExtent(radius, reach(parts.filter((p) => p.shape.kind === 'sphere')), eyeDistance);
  for (const { shape } of parts) {
    if (shape.kind !== 'ring') continue;
    const plane = d + shape.depth;
    if (plane > 0) out = Math.max(out, (radius * shape.outer * ringScale(shape, d) * d) / plane);
  }
  return out;
}

/** How far a body's parts reach from its centre, in its radii (its shells, rings, offset moons): at least 1. */
export function reach(parts: readonly BodyPart[], distance?: number): number {
  return Math.max(
    1,
    ...parts.map((p) =>
      p.shape.kind === 'sphere'
        ? p.shape.radius + Math.hypot(...(p.shape.centre ?? [0, 0, 0]))
        : p.shape.outer * (distance ? ringScale(p.shape, distance) : 1),
    ),
  );
}

/** A float render target (half floats where the browser can render to them), with depth. */
interface Target {
  readonly framebuffer: WebGLFramebuffer;
  readonly depth: WebGLRenderbuffer;
  texture: WebGLTexture | null;
  /** What blooms under the planets' own lights' thresholds beyond the scene's. */
  glow: WebGLTexture | null;
}

const moves = (m: SceneMaterial) =>
  [m.diffuse, m.emissive, ...m.alphaMasks].some((layer) => layer?.scroll);

interface ParticleDraw {
  /** Its material's name (the sky's settings for it apply). */
  readonly name: string;
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
 * only what moves (the energy's scroll, the particles). Each target also keeps what glows beyond
 * the scene's own bloom, for the bloom pass. Each material is drawn as its settings say (the
 * sky's as set by `setSky`; a planet's as its placement, its tuning and its style's say): not at
 * all, fainter, blended another way, glowing more or less, its pattern sized.
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
  private readonly compositeProgram: WebGLProgram;
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
  /**
   * What doesn't move, drawn once per size: the background (the sky, behind every object), and the
   * scene's objects on their own (premultiplied, over nothing) for what moves behind them to go under.
   */
  private readonly stillBackground: Target;
  private readonly stillScene: Target;
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
    this.compositeProgram = program(gl, TONE_VERTEX, COMPOSITE_FRAGMENT);
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
    const target = (): Target => ({
      framebuffer: gl.createFramebuffer(),
      depth: gl.createRenderbuffer(),
      texture: null,
      glow: null,
    });
    this.stillBackground = target();
    this.stillScene = target();
    this.frame = target();
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
          name: m,
          material,
          moving: moves(material),
        });
      }
    }
    for (const system of scene.particles) {
      const emitter = scene.meshes[system.emitter];
      if (!emitter) throw new Error(`the particles' emitter ${system.emitter} isn't in the scene`);
      const particles = new ParticleSystem(system, emitter);
      const [vao, buffer] = this.particleVao(particles);
      this.particles.push({
        name: system.material,
        system: particles,
        vao,
        buffer,
        material: this.material(system.material, 'particles', scene.materials),
      });
    }
    this.draws = [...this.sceneDraws];
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
      extent: partsExtent(placement.radius, partsOf(placement), distance(placement.position, eye)),
    }));
    const draws: MeshDraw[] = [];
    for (const placed of this.placed) {
      const { planet, style } = placed.placement;
      for (const loaded of style ? [planet, style] : [planet]) {
        if (this.planetsOnGpu.has(loaded.id)) continue;
        for (const [textureKey, image] of Object.entries(loaded.images))
          if (!this.textures.has(textureKey)) this.textures.set(textureKey, this.texture(image));
        this.planetsOnGpu.add(loaded.id);
      }
      // The body's own parts lit by the style's light where it has one, then the style's parts.
      const light = style?.planet.light ?? planet.planet.light;
      for (const loaded of style ? [planet, style] : [planet]) {
        const parts = loaded === style ? styleParts(placed.placement) : loaded.planet.parts;
        parts.forEach((part, i) => {
          for (const m of part.materials) {
            const material = this.material(m, `${loaded.id}/${i}`, loaded.planet.materials);
            draws.push({
              vao: this.quad,
              count: 4,
              name: m,
              material,
              moving: moves(material),
              placed,
              owner: loaded,
              part,
              partKey: partKey(loaded === style ? 'style' : 'own', part.role),
              light,
            });
          }
        });
      }
    }
    this.draws = [...this.sceneDraws, ...draws];
    this.stillDirty = true;
  }

  /**
   * Where each placed planet is on the canvas, as it was last placed: its centre, and the top of
   * its body, as shares of the canvas's width and height from its top left; none for one behind
   * the camera.
   */
  /**
   * The placed planet under a point of the view (`x`, `y`: shares of its width and height; the
   * view `aspect` wide), by its index in what was put up (`setPlanets`); the nearest where they
   * overlap; null where there is none. Its body counts, not its halo.
   */
  pick(x: number, y: number, aspect: number): number | null {
    const viewProjection = multiply(this.projection, this.view);
    const m = viewProjection;
    const project = (p: Vec3): [number, number, number] | null => {
      const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
      if (w <= 0) return null;
      const px = (m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!) / w;
      const py = (m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!) / w;
      return [(px + 1) / 2, (1 - py) / 2, w];
    };
    let best: { index: number; depth: number } | null = null;
    this.placed.forEach(({ placement }, index) => {
      if (placement.hidden) return;
      const { position, radius } = placement;
      const centre = project(position);
      const top = project([position[0], position[1], position[2] + radius]);
      if (!centre || !top) return;
      const r = Math.abs(centre[1] - top[1]);
      const hit = Math.hypot((x - centre[0]) * aspect, y - centre[1]) <= r;
      if (hit && (!best || centre[2] < best.depth)) best = { index, depth: centre[2] };
    });
    return (best as { index: number } | null)?.index ?? null;
  }

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
      if (centre && top)
        out.push({
          id: placement.planet.label ?? placement.planet.id,
          x: centre[0],
          y: centre[1],
          top: top[1],
        });
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
      placed.extent = partsExtent(radius, partsOf(placed.placement), distance(position, eye));
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
      Infinity, // the scene's objects however far they are set (the sky is drawn behind them anyway)
    );
    this.allocate(this.stillBackground);
    this.allocate(this.stillScene);
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
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target.texture,
        0,
      );
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

  /** What doesn't move, drawn into its targets: the background's, and the scene's over nothing. */
  private drawStill(): void {
    // Behind a backdrop the alpha keeps what the scene covers (none yet).
    this.begin(this.stillBackground, this.backdrop ? 0 : 1);
    this.drawMeshes(0, { moving: false, depth: 'background' });
    this.begin(this.stillScene, 0);
    this.drawMeshes(0, { moving: false, depth: 'scene' });
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.stillDirty = false;
  }

  /** A target's colour and glow over the bound one, as far as its alpha covers. */
  private composite(target: Target): void {
    const gl = this.gl;
    const p = this.compositeProgram;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindSampler(0, null);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.uniform1i(this.uniform(p, 'uColor'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindSampler(1, null);
    gl.bindTexture(gl.TEXTURE_2D, target.glow);
    gl.uniform1i(this.uniform(p, 'uGlow'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** One target's colour and glow, or its depth, into another as they are; the other bound after. */
  private copy(from: Target, into: Target, what: 'colour' | 'depth'): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, into.framebuffer);
    if (what === 'depth') {
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    } else {
      // One attachment at a time (a blit copies the one read into every one drawn).
      for (let i = 0; i < DRAW_BUFFERS.length; i++) {
        gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
        gl.drawBuffers(DRAW_BUFFERS.map((b, j) => (j === i ? b : gl.NONE)));
        gl.blitFramebuffer(
          0,
          0,
          width,
          height,
          0,
          0,
          width,
          height,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST,
        );
      }
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.drawBuffers(DRAW_BUFFERS);
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer);
  }

  /** The particles drawn at this depth: they add light, hidden behind what is opaque in the scene. */
  private drawParticles(seconds: number, depth: MaterialDepth): void {
    const gl = this.gl;
    const particles = (this.backdrop ? [] : this.particles).filter(
      (p) => this.depthOf(p.name, this.sky.materials?.[p.name], false) === depth,
    );
    if (!particles.length) return;
    this.depthTest(depth);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this.particleProgram);
    gl.bindSampler(0, null); // the particles' textures sample as they are set
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uView'), false, this.view);
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uProjection'), false, this.projection);
    gl.uniform1f(this.uniform(this.particleProgram, 'uStreak'), this.streak);
    this.bindTint(this.particleProgram, 'uBodyTint', this.sky.tint);
    for (const p of particles) {
      p.system.update(seconds);
      // The sky's settings for its material: drawn or not, and how strongly.
      const settings = this.sky.materials?.[p.name];
      if (!(settings?.enabled ?? MATERIAL_DEFAULTS.enabled)) continue;
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
        layerBrightness(layer.brightMult) * (settings?.strength ?? MATERIAL_DEFAULTS.strength),
      );
      gl.bindVertexArray(p.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.system.instances, 0, p.system.count * INSTANCE_FLOATS);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, p.system.count);
    }
    gl.bindVertexArray(null);
  }

  /**
   * Where a material is drawn among the scene's objects: a placed planet's among them, the sky's
   * as set, else where the game data puts it (see `skyDepths`).
   */
  private depthOf(
    name: string,
    settings: MaterialSettings | undefined,
    placed: boolean,
  ): MaterialDepth {
    if (placed) return 'scene';
    return settings?.depth ?? skyDepths(this.loaded.scene)[name] ?? 'background';
  }

  /** The depth test as a depth says: only the scene's objects are tested (the rest are drawn over). */
  private depthTest(depth: MaterialDepth): void {
    if (depth === 'scene') this.gl.enable(this.gl.DEPTH_TEST);
    else this.gl.disable(this.gl.DEPTH_TEST);
  }

  /** How far the stars are streaked across the view, 0 to 1 (0: not at all). */
  streak = 0;
  /** How far the sky's layers are smeared across, as a share of the way round the sky (0: not at all). */
  smear = 0;
  /** The tint drawn over the whole picture. */
  tint: Tint = NO_TINT;
  /** The tint the picture fades from, and how far it is from it to `tint` (1: all the way). */
  fadingFrom: Tint = NO_TINT;
  fade = 1;
  /** How the sky shows: its materials' settings by name, and its tint. */
  private sky: SkySettings = {};
  /** An editing backdrop in place of the sky, if any. */
  private backdrop: Backdrop | null = null;

  /** An editing backdrop shown in place of the sky (null: the sky again). */
  setBackdrop(backdrop: Backdrop | null): void {
    this.backdrop = backdrop;
    this.stillDirty = true;
  }

  /** The scene's lights: added to every planet's (see `scene-lights.ts`). */
  private sceneLights: readonly AddedLight[] = [];

  /** The scene's lights, lighting every planet as its own added ones do. */
  setSceneLights(lights: readonly AddedLight[]): void {
    this.sceneLights = lights;
    this.stillDirty = true;
  }

  /** The lights added to a placed planet: its own and its overlay's, then the scene's. */
  private addedTo(placement: PlanetPlacement | undefined): readonly AddedLight[] {
    if (!placement) return [];
    return placement.added?.length ? [...placement.added, ...this.sceneLights] : this.sceneLights;
  }

  /** The sky shown as these settings say (materials not named, as the data has them). */
  setSky(settings: SkySettings): void {
    this.sky = settings;
    this.stillDirty = true;
  }

  /** The scene at `seconds` on its clock. */
  draw(seconds: number): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    if (this.stillDirty) this.drawStill();
    // In depth order: the background (as if infinitely far: under every object, wherever it is
    // set), what doesn't move of it and then what does; the scene's objects over it, what doesn't
    // move and then what does, at their depths; the foreground over all of them (as if at the camera).
    this.copy(this.stillBackground, this.frame, 'colour');
    gl.viewport(0, 0, width, height);
    this.drawMeshes(seconds, { moving: true, depth: 'background' });
    this.drawParticles(seconds, 'background');
    this.composite(this.stillScene);
    this.copy(this.stillScene, this.frame, 'depth');
    this.drawMeshes(seconds, { moving: true, depth: 'scene' });
    this.drawParticles(seconds, 'scene');
    this.drawMeshes(seconds, { depth: 'foreground' });
    this.drawParticles(seconds, 'foreground');

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.toneProgram);
    gl.bindSampler(0, null); // the tone pass's textures sample as they are set
    gl.bindSampler(1, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.texture);
    gl.uniform1i(this.uniform(this.toneProgram, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom[0]!.texture);
    gl.uniform1i(this.uniform(this.toneProgram, 'uBloom'), 1);
    gl.uniform1f(this.uniform(this.toneProgram, 'uBloomStrength'), BLOOM_STRENGTH);
    const tints = [this.tint, this.fadingFrom];
    gl.uniform3fv(
      this.uniform(this.toneProgram, 'uTint'),
      tints.flatMap((t) => [...t.colour]),
    );
    gl.uniform1iv(
      this.uniform(this.toneProgram, 'uBlend'),
      tints.map((t) => BLEND_MODES[t.blend]),
    );
    gl.uniform1f(this.uniform(this.toneProgram, 'uFade'), this.fade);
    gl.uniform1f(this.uniform(this.toneProgram, 'uExposure'), this.loaded.scene.tone.exposure);
    gl.uniform1f(this.uniform(this.toneProgram, 'uWhitePoint'), this.loaded.scene.tone.whitePoint);
    const b = this.backdrop;
    gl.uniform1i(
      this.uniform(this.toneProgram, 'uBackdrop'),
      b ? (b.kind === 'colour' ? 1 : 2) : 0,
    );
    if (b) {
      const [first, second] = b.kind === 'colour' ? [b.colour, b.colour] : b.colours;
      gl.uniform3fv(this.uniform(this.toneProgram, 'uBackdropA'), first);
      gl.uniform3fv(this.uniform(this.toneProgram, 'uBackdropB'), second);
      // The squares in CSS pixels, whatever share of the display's resolution the canvas has.
      const cssWidth = this.canvas.clientWidth || width;
      const size = b.kind === 'grid' ? b.size : 1;
      gl.uniform1f(
        this.uniform(this.toneProgram, 'uGridSize'),
        Math.max(1, (size * width) / cssWidth),
      );
    }
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
      this.compositeProgram,
    ])
      gl.deleteProgram(p);
    for (const target of this.bloom) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    for (const target of [this.stillBackground, this.stillScene, this.frame]) {
      gl.deleteTexture(target.texture);
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
    gl.deleteTexture(target.glow);
    target.glow = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target.glow);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.format, this.canvas.width, this.canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, target.glow, 0);
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

  /** Draw into a target from black (covering as far as `alpha` says), nothing in front yet. */
  private begin(target: Target, alpha: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, alpha);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** A blend: opaque writes colour and depth; the rest add or blend over. */
  private blend(blend: SceneBlend): void {
    const gl = this.gl;
    if (blend === 'opaque') {
      // Opaque but for a body's smoothed edge, which it gives as its alpha (premultiplied).
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(true);
      return;
    }
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (blend === 'alpha') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Added light covers nothing: the alpha (what a backdrop shows under) is left as it is.
    else gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
  }

  /**
   * A draw's material's settings: the placement's say over its owner's tuning (a planet's for its
   * materials, its style's for the style's) and how the planet wears its style, or the sky's as set.
   */
  private settingsOf(draw: MeshDraw): MaterialSettings | undefined {
    const placement = draw.placed?.placement;
    if (!placement) return this.sky.materials?.[draw.name];
    return mergeMaterialSettings(
      draw.owner?.planet.tuning?.materials,
      wearIn(placement)?.materials,
      placement.materials,
    )[draw.name];
  }

  /**
   * The mesh draws at a depth (those that move, or those that don't, if asked), into the bound
   * target: the scene's depth-tested, the background's and foreground's drawn over what is there.
   */
  private drawMeshes(seconds: number, which: { moving?: boolean; depth: MaterialDepth }): void {
    const gl = this.gl;
    this.depthTest(which.depth);
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
    gl.uniform1i(this.uniform(this.meshProgram, 'uPattern'), 0);
    gl.uniform1i(this.uniform(this.meshProgram, 'uShadeCount'), 0);
    this.bindTint(this.meshProgram, 'uBodyTint', this.sky.tint); // the sky's over all of it
    gl.uniform2f(this.uniform(this.meshProgram, 'uRimTurn'), 0, 0);
    gl.uniform3fv(this.uniform(this.meshProgram, 'uEye'), this.loaded.scene.camera.eye);
    gl.uniform3fv(this.uniform(this.meshProgram, 'uRight'), right);
    gl.uniform3fv(this.uniform(this.meshProgram, 'uUp'), up);
    gl.uniform1f(this.uniform(this.meshProgram, 'uSmear'), this.smear);
    gl.uniform1i(this.uniform(this.meshProgram, 'uLit'), 0);
    let program = this.meshProgram;
    // Each draw as its material's settings say; the sky's in drawing order by the blend they
    // give it, then the planets' likewise.
    // A material as set: its masks and its layers' textures and transforms (a scroll set makes
    // it move).
    const loaded = (texture: string) => this.textures.has(texture);
    const set = this.draws
      .filter((draw) => draw.placed || !this.backdrop)
      .map((draw) => {
        const settings = this.settingsOf(draw);
        const layered = withLayers(
          withMasks(draw.material, settings?.masks),
          settings?.layers,
          loaded,
        );
        // Lit or flat as set (else as the data has it); lit with no light to light it: flat.
        const unshaded =
          !!draw.part &&
          ((settings?.lit !== undefined ? !settings.lit : layered.unshaded) ||
            (!draw.light &&
              !this.addedTo(draw.placed?.placement).some(
                (l) => l.kind === 'ambient' || l.kind === 'directional',
              )));
        const material =
          draw.part && unshaded !== layered.unshaded ? { ...layered, unshaded } : layered;
        const moving = draw.moving || (material !== draw.material && moves(material));
        return { draw, settings, material, moving, blend: settings?.blend ?? draw.material.blend };
      });
    // Where any body moves, every body is drawn each frame: together, in their order (a surface
    // drawn after a glow that is in front of it would cover the glow).
    const bodiesMove = set.some((d) => d.draw.placed && d.moving);
    const draws = set
      .map((d) => (d.draw.placed && bodiesMove ? { ...d, moving: true } : d))
      .filter(
        ({ draw, settings, moving }) =>
          (which.moving === undefined || moving === which.moving) &&
          (settings?.enabled ?? MATERIAL_DEFAULTS.enabled) &&
          shown(draw) &&
          this.depthOf(draw.name, settings, !!draw.placed) === which.depth,
      );
    if (!draws.length) return;
    const ordered = [
      ...sorted(
        draws.filter((d) => !d.draw.placed),
        () => this.sky.order,
      ),
      ...sorted(
        draws.filter((d) => d.draw.placed),
        (placed) => placed?.placement.order,
      ),
    ];
    for (const { draw, settings, material, blend } of ordered) {
      const p = draw.part ? this.bodyProgram : this.meshProgram;
      if (p !== program) gl.useProgram((program = p));
      gl.bindVertexArray(draw.vao);
      this.blend(blend);
      if (which.depth !== 'scene') gl.depthMask(false); // as if infinitely far, or at the camera
      const scale = settings?.scale ?? MATERIAL_DEFAULTS.scale;
      this.bindMaterial(p, material, seconds, scale, blend, settings?.spreadFrom);
      gl.uniform1f(this.uniform(p, 'uGlowBoost'), settings?.glow ?? MATERIAL_DEFAULTS.glow);
      gl.uniform1f(this.uniform(p, 'uSpread'), settings?.spread ?? -1);
      gl.uniform1f(this.uniform(p, 'uFalloff'), settings?.falloff ?? MATERIAL_DEFAULTS.falloff);
      gl.uniform1f(this.uniform(p, 'uCut'), settings?.cut ?? MATERIAL_DEFAULTS.cut);
      gl.uniform1f(this.uniform(p, 'uStrength'), settings?.strength ?? MATERIAL_DEFAULTS.strength);
      this.bindTint(p, 'uTint', settings?.tint);
      const placement = draw.placed?.placement;
      if (draw.part && draw.placed && placement) {
        const part = withPart(draw.part, draw.partKey && placement.parts?.[draw.partKey]);
        this.bindPart(part, draw.placed, right, up);
        const tuning = placement.planet.planet.tuning;
        const rig = material.unshaded ? undefined : draw.light;
        const turned =
          rig &&
          tunedRig(
            rig,
            placement.lighting ?? tuning?.lighting,
            placement.lightFrom ?? tuning?.lightFrom,
          );
        // Its rig as set, and the lights added to it (its own, its overlay's, its scene's), each
        // only where it reaches this part and material (its linking).
        const added = this.addedTo(placement);
        const linked = linkedSettings(placement.lights, added, draw.partKey, draw.name);
        const light = material.unshaded
          ? undefined
          : withAddedLights(
              turned && withLightSettings(turned, linked),
              added,
              linked,
              this.loaded.scene.tone.exposure,
            );
        this.bindLight(light);
        this.bindTint(p, 'uBodyTint', placement.tint ?? tuning?.tint);
        const rim = placement.rim ?? tuning?.rim;
        gl.uniform2fv(this.uniform(p, 'uRimTurn'), rim ? rimTurn(rim) : [0, 0]);
        this.bindShade(placement, linked);
        // A grid: shown where its reveal lights reach (its own, then those added) and coloured
        // by its activation lights (those tied to its own reveal light from its side).
        if (draw.part.pattern?.kind === 'hex') {
          const data = dataReveal(linked?.reveal);
          const activation = dataActivation(linked?.activation);
          const tiedTo = revealFrom(placement.lights);
          this.bindGrid(
            p,
            [...(data ? [data] : []), ...fieldLights('reveal', added, linked)],
            [...(activation ? [activation] : []), ...fieldLights('activation', added, linked)].map(
              (l) => (l.tied ? { ...l, from: tiedTo } : l),
            ),
            settings?.inactive,
            settings?.active ?? DEFAULT_ACTIVE,
          );
        }
        // The body glows under its own light's bloom threshold, lit or not (its city lights aren't lit).
        const own = (placement.style ?? placement.planet).planet.light;
        gl.uniform1f(this.uniform(p, 'uGlowThreshold'), own?.bloomThreshold ?? threshold);
        // A drawn pattern (unless shown as its texture, as the game does): as many cells round
        // the part as its texture has (or HEX_ROUND), over its scale; its lines' width and glow.
        const pattern = draw.part.pattern;
        const drawn = pattern?.kind === 'hex' && settings?.drawAs !== 'texture';
        const round = pattern?.across
          ? pattern.across * (material.emissive?.tiling?.[0] ?? 1)
          : HEX_ROUND;
        gl.uniform1i(this.uniform(p, 'uPattern'), drawn ? 1 : 0);
        gl.uniform3f(
          this.uniform(p, 'uPatternParams'),
          round / scale,
          settings?.width ?? MATERIAL_DEFAULTS.width,
          settings?.soft ?? MATERIAL_DEFAULTS.soft,
        );
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, draw.count);
      } else {
        gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, 0);
      }
    }
    gl.bindVertexArray(null);
  }

  /** A tint into the uniforms `<name>Color`, `<name>Blend` and `<name>Strength` (none: strength 0). */
  private bindTint(p: WebGLProgram, name: string, tint: MaterialTint | undefined): void {
    const gl = this.gl;
    const colour = tint ? parseCanvasColour(tint.colour) : null;
    gl.uniform1f(this.uniform(p, `${name}Strength`), colour && tint ? tint.strength : 0);
    if (!colour || !tint) return;
    gl.uniform3fv(this.uniform(p, `${name}Color`), colour);
    gl.uniform1i(this.uniform(p, `${name}Blend`), BLEND_MODES[tint.blend]);
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
      const k = ringScale(shape, Math.hypot(eye[0], eye[1], eye[2]));
      gl.uniform3f(this.uniform(p, 'uShapeParams'), shape.inner * k, shape.outer * k, shape.depth);
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
      gl.uniform4f(at('a'), mapping.from, mapping.uMax, mapping.mid ?? 0.5, 0);
    }
  }

  /** A placed planet's shade, for the body shader: its own over its style's over the default (none). */
  private bindShade(placement: PlanetPlacement, lights: LightSettingsMap | undefined): void {
    const gl = this.gl;
    const p = this.bodyProgram;
    // The planet's own tuning shades it as it is; a style it wears shades it its way instead,
    // as the planet wears it.
    const shade = withShadowSettings(
      {
        ...DEFAULT_SHADE,
        ...placement.planet.planet.tuning?.shade,
        ...placement.style?.planet.shade,
        ...wearIn(placement)?.shade,
        ...placement.shade,
      },
      lights?.shadow,
    );
    // Its own shade, then the shadows added to it (its own, its overlay's, its scene's).
    const shades = [shade, ...addedShades(this.addedTo(placement), lights)].slice(0, MAX_SHADES);
    const pad = (n: number) => Array<number>((MAX_SHADES - shades.length) * n).fill(0);
    gl.uniform1i(this.uniform(p, 'uShadeCount'), shades.length);
    gl.uniform3fv(this.uniform(p, 'uShadeDir'), [
      ...shades.flatMap((s) => [...normalize(s.direction)]),
      ...pad(3),
    ]);
    gl.uniform1fv(this.uniform(p, 'uShadeStrength'), [...shades.map((s) => s.strength), ...pad(1)]);
    gl.uniform1fv(this.uniform(p, 'uShadeSoftness'), [...shades.map((s) => s.softness), ...pad(1)]);
  }

  /** How a body's part is lit, for the body shader: not at all (no rig), or by its rig. */
  private bindLight(light: PlanetLight | undefined): void {
    const gl = this.gl;
    const p = this.bodyProgram;
    gl.uniform1i(this.uniform(p, 'uLit'), light ? 1 : 0);
    if (!light) return;
    const lights = light.directional.slice(0, MAX_LIGHTS);
    const pad = Array<number>((MAX_LIGHTS - lights.length) * 3).fill(0);
    // The light's exposure over the scene's: the planet as bright as the tutorial shows it.
    const scale = light.exposure / this.loaded.scene.tone.exposure;
    gl.uniform3fv(this.uniform(p, 'uAmbient'), light.ambient);
    gl.uniform1i(this.uniform(p, 'uLightCount'), lights.length);
    gl.uniform3fv(this.uniform(p, 'uLightDir'), [
      ...lights.flatMap((l) => [...l.direction]),
      ...pad,
    ]);
    gl.uniform3fv(this.uniform(p, 'uLightColor'), [...lights.flatMap((l) => [...l.color]), ...pad]);
    gl.uniform1f(this.uniform(p, 'uLightScale'), scale);
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

  /**
   * `emissiveScale` sizes the emissive layer's pattern (its tiling over it: 2, twice the size);
   * `blend` is the blend it is drawn with (its own, or its settings'); `spreadFrom`, where set, is
   * the side its layers' fresnel is brightest on, in place of their own turn (which leans the other way).
   */
  private bindMaterial(
    p: WebGLProgram,
    material: SceneMaterial,
    seconds: number,
    emissiveScale: number,
    blend: SceneBlend,
    spreadFrom?: Vec3,
  ): void {
    const turn = spreadFrom ? rimTurn(spreadFrom).map((a) => -a) : null;
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
      const tiling = layer.tiling ?? [1, 1];
      const scale = i === 1 ? emissiveScale : 1;
      gl.uniform2f(at('tiling'), tiling[0] / scale, tiling[1] / scale);
      const f = layer.fresnel;
      gl.uniform1i(at('fresnel'), f?.type ?? 0);
      gl.uniform1f(at('fExponent'), f?.exponent ?? 1);
      gl.uniform1f(at('fMin'), f?.min ?? 0);
      gl.uniform1f(at('fMax'), f?.max ?? 1);
      gl.uniform2f(at('fTurn'), turn?.[0] ?? f?.yaw ?? 0, turn?.[1] ?? f?.pitch ?? 0);
    });
    gl.uniform1i(this.uniform(p, 'uUnshaded'), material.unshaded ? 1 : 0);
    gl.uniform1i(this.uniform(p, 'uVertexAlpha'), material.vertexAlpha ? 1 : 0);
    gl.uniform1i(this.uniform(p, 'uVertexColor'), material.vertexColor ? 1 : 0);
    gl.uniform1f(this.uniform(p, 'uEmissiveMult'), material.emissiveMult);
    gl.uniform1i(this.uniform(p, 'uOpaque'), blend === 'opaque' ? 1 : 0);
    gl.uniform1i(
      this.uniform(p, 'uEmissiveBlend'),
      { mod: 0, mod2x: 1, add: 2 }[material.emissiveBlend ?? 'add'],
    );
    gl.uniform1f(this.uniform(p, 'uCutout'), material.cutout ?? 0);
    // Not a grid unless bound as one (`bindGrid`): its layers' own fresnel, its own colour.
    gl.uniform1i(this.uniform(p, 'uRevealed'), 0);
    gl.uniform1i(this.uniform(p, 'uActivationCount'), 0);
  }

  /**
   * A grid's reveal and activation lights (each at most MAX_FIELDS) and its colours: inactive in
   * place of its diffuse's own where set, and active.
   */
  private bindGrid(
    p: WebGLProgram,
    reveals: readonly FieldLight[],
    activations: readonly FieldLight[],
    inactive: string | undefined,
    active: string,
  ): void {
    const gl = this.gl;
    const pad = <T>(list: readonly T[], fill: T): T[] => [
      ...list.slice(0, MAX_FIELDS),
      ...Array<T>(Math.max(0, MAX_FIELDS - list.length)).fill(fill),
    ];
    const r = reveals.slice(0, MAX_FIELDS);
    gl.uniform1i(this.uniform(p, 'uRevealed'), 1);
    gl.uniform1i(this.uniform(p, 'uRevealCount'), r.length);
    gl.uniform3fv(
      this.uniform(p, 'uRevealFrom'),
      pad(
        r.map((l) => [...normalize(l.from)]),
        [0, -1, 0],
      ).flat(),
    );
    gl.uniform1fv(
      this.uniform(p, 'uRevealSpread'),
      pad(
        r.map((l) => l.spread),
        0,
      ),
    );
    gl.uniform1fv(
      this.uniform(p, 'uRevealFalloff'),
      pad(
        r.map((l) => l.falloff),
        1,
      ),
    );
    gl.uniform1fv(
      this.uniform(p, 'uRevealStrength'),
      pad(
        r.map((l) => l.strength),
        0,
      ),
    );
    const a = activations.slice(0, MAX_FIELDS);
    gl.uniform1i(this.uniform(p, 'uActivationCount'), a.length);
    gl.uniform3fv(
      this.uniform(p, 'uActivationFrom'),
      pad(
        a.map((l) => [...normalize(l.from)]),
        [0, -1, 0],
      ).flat(),
    );
    gl.uniform1fv(
      this.uniform(p, 'uActivationSpread'),
      pad(
        a.map((l) => l.spread),
        0,
      ),
    );
    gl.uniform1fv(
      this.uniform(p, 'uActivationFalloff'),
      pad(
        a.map((l) => l.falloff),
        1,
      ),
    );
    gl.uniform1fv(
      this.uniform(p, 'uActivationStrength'),
      pad(
        a.map((l) => l.strength),
        0,
      ),
    );
    gl.uniform1fv(
      this.uniform(p, 'uActivationEnergy'),
      pad(
        a.map((l) => l.energizes ?? 0),
        0,
      ),
    );
    gl.uniform1fv(
      this.uniform(p, 'uActivationGlow'),
      pad(
        a.map((l) => l.glow ?? 0),
        0,
      ),
    );
    gl.uniform3fv(this.uniform(p, 'uActiveColor'), rgbOf(active, 1));
    if (inactive) {
      const c = rgbOf(inactive, 1);
      gl.uniform4f(this.uniform(p, 'uLayers[0].color'), c[0], c[1], c[2], 1);
    }
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
