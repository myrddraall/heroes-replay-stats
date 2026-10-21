import { BLEND_GLSL, TINT_GLSL } from './scene-tints';

/**
 * The renderer's shaders' sources (see \`SceneRenderer\`): the meshes', the bodies' (one, any part's
 * shape chosen as it runs, \`bodyFragment\`), the particles', the passes'.
 */
/** How many directional lights, and how many shades (shadows), a body is drawn with at most. */
export const MAX_LIGHTS = 8;
export const MAX_SHADES = 4;
/** How many reveals, and how many activations, a grid is drawn with at most (its material's own: one of each). */
export const MAX_FIELDS = 4;

/** How many values a uv sphere's v table has, from the pole to the opposite one (as exported). */
export const V_SAMPLES = 32;

export const MESH_VERTEX = `#version 300 es
in vec3 aPosition;
in vec2 aUv;
in vec2 aUv2;
in vec3 aNormal;
in vec4 aColor;
uniform mat4 uViewProjection;
out vec2 iUv;
out vec2 iUv2;
out vec3 iNormal;
out vec3 iWorld;
out vec4 iColor;
void main() {
  iUv = aUv;
  iUv2 = aUv2;
  iNormal = aNormal;
  iWorld = aPosition;
  iColor = aColor;
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
export const MATERIAL_GLSL = `
struct Layer {
  bool used; bool textured; vec4 color; int uvSet; int channel; float bright; float midtone;
  vec2 offset; float angle; vec2 tiling;
  int fresnel; float fExponent; float fMin; float fMax; vec2 fTurn;
};
const float FRESNEL_GAIN = 4.3;
uniform sampler2D uDiffuse, uEmissive, uMask0, uMask1, uSpecular;
uniform Layer uLayers[5];
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
uniform float uLightSoftness[MAX_LIGHTS];
uniform vec3 uLightSpecular[MAX_LIGHTS];
uniform float uSpecularity, uSpecularMult;
uniform int uLightCount;
uniform float uLightScale;
uniform vec3 uEye, uRight, uUp;
uniform float uGlowThreshold, uSceneThreshold, uGlowBoost;
uniform float uStrength, uSpread, uCut, uFalloff;
uniform int uPattern;
uniform vec3 uPatternParams;
uniform vec3 uShadeDir[MAX_SHADES], uShadeColor[MAX_SHADES];
uniform float uShadeStrength[MAX_SHADES], uShadeSoftness[MAX_SHADES];
uniform int uShadeCount;
// A grid's: shown where its reveal reaches (its emissive times how much), coloured from
// inactive (its diffuse) to uActiveColor where its activation reaches; each its side
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
// What is drawn: the colour (0), or in its place the glow (1: what blooms beyond the scene's own
// bloom), each into a target of its own (a draw writes one output: see the renderer's targets).
uniform int uOutput;
vec4 outGlow;
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
  // The turn (the layer's own), and its planet's lean of its rims and glows.
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
#if GRID
// How much a grid's reveal or activation reaches here, 0 to 1: as a light does, the more the face turns to its
// side (any side, the far one too), wrapped round by its spread (0: the half facing it; 1: on round
// to the point facing away, fading all the way) and sharpened by its falloff. Times its strength
// (more than 1 reaches further fully), what it reaches never comes out even: its side and its
// falloff always tell.
float fieldAt(vec3 from, float spread, float falloff) {
  // From all round: all of it alike.
  if (dot(from, from) == 0.0) return 1.0;
  float facing = dot(normalize(vNormal), normalize(from));
  return pow(clamp((facing + spread) / (1.0 + spread), 0.0, 1.0), falloff);
}
float activationAt(int i) {
  return fieldAt(uActivationFrom[i], uActivationSpread[i], uActivationFalloff[i]);
}
// How active a grid is here: its activations added up (0 to 1), each times its strength (one
// that darkens taking away).
float activation() {
  float a = 0.0;
  for (int i = 0; i < MAX_FIELDS; i++) {
    if (i >= uActivationCount) break;
    a += uActivationStrength[i] * activationAt(i);
  }
  return clamp(a, 0.0, 1.0);
}
// How much brighter a grid shines here, and blooms: what its glowing activations activate,
// times how much each glows.
float activeGlow() {
  float g = 0.0;
  for (int i = 0; i < MAX_FIELDS; i++) {
    if (i >= uActivationCount) break;
    g += uActivationGlow[i] * min(uActivationStrength[i] * activationAt(i), 1.0);
  }
  return max(g, 0.0);
}
// How much of a grid shows here, 0 to 1: its reveals added up, and what its energizing
// activations reveal too (as much as they activate, times how much each energizes).
float revealed() {
  float sum = 0.0;
  for (int i = 0; i < MAX_FIELDS; i++)
    if (i < uRevealCount)
      sum += uRevealStrength[i] * fieldAt(uRevealFrom[i], uRevealSpread[i], uRevealFalloff[i]);
  for (int i = 0; i < MAX_FIELDS; i++)
    if (i < uActivationCount)
      sum += uActivationEnergy[i] * uActivationStrength[i] * activationAt(i);
  return clamp(sum, 0.0, 1.0);
}
#endif
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
#if SMEAR
  if (uSmear <= 0.0) return sampled(tex, layerUv(l));
  vec4 sum = vec4(0.0);
  for (int k = -3; k <= 3; k++) sum += texture(tex, layerUvFrom(l, float(k) * uSmear / 3.0));
  return sum / 7.0;
#else
  return sampled(tex, layerUv(l));
#endif
}
vec4 colorLayer(sampler2D tex, Layer l) {
  if (!l.used) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 v = l.textured ? midtone(channel(texel(tex, l), l.channel), l.midtone) : l.color;
  return vec4(v.rgb * l.bright * fresnel(l), v.a);
}
#if PATTERN
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
#endif
float maskLayer(sampler2D tex, Layer l) {
  if (!l.used) return 1.0;
  if (uOpaque && l.midtone >= 1.0) return 1.0; // fully born: nothing cut out
  float v = clamp(channel(sampled(tex, layerUv(l)), l.channel).a * l.bright, 0.0, 1.0);
  return midtone(vec4(v), l.midtone).a * (l.fresnel == 0 ? 1.0 : clamp(fresnelFormula(l), 0.0, 1.0));
}
#if LIT
vec3 lit(vec3 albedo) {
  vec3 n = normalize(vNormal);
  vec3 light = uAmbient;
  // The shine, where the material has a specular layer: each light's specular colour where the
  // surface turns halfway between it and the eye, to the material's specularity (Blinn-Phong).
  vec3 map = uLayers[4].used ? colorLayer(uSpecular, uLayers[4]).rgb * uSpecularMult : vec3(0.0);
  bool shines = dot(map, map) > 0.0;
  vec3 view = normalize(uEye - vWorld);
  vec3 shine = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) continue;
    vec3 to = -normalize(uLightDir[i]);
    float facing = dot(n, to);
    light += uLightColor[i] * pow(max(0.0, facing), uLightSoftness[i]);
    if (shines && facing > 0.0)
      shine += uLightSpecular[i] * pow(max(0.0, dot(n, normalize(to + view))), uSpecularity);
  }
  return (albedo * light + shine * map) * uLightScale;
}
#endif
void shade() {
  vec4 diffuse = colorLayer(uDiffuse, uLayers[0]);
  if (uVertexColor) diffuse.rgb *= vColor.rgb;
  // A grid's colour, from inactive (its own) towards active where its activation reaches.
#if GRID
  if (uActivationCount > 0) diffuse.rgb = mix(diffuse.rgb, uActiveColor * uLayers[0].bright, activation());
#endif
#if PATTERN
  vec4 emissive = uPattern == 1 ? patternLayer(uLayers[1]) : colorLayer(uEmissive, uLayers[1]);
#else
  vec4 emissive = colorLayer(uEmissive, uLayers[1]);
#endif
#if GRID
  // A grid shows where its reveal reaches it (with its own fade, the game's look).
  if (uRevealed) emissive.rgb *= revealed();
#endif
#if LIT
  vec3 base = uUnshaded ? diffuse.rgb : uLit ? lit(diffuse.rgb) : vec3(0.0);
#else
  vec3 base = uUnshaded ? diffuse.rgb : vec3(0.0);
#endif
#if SHADES
  // The lights that darken it (its shadows): its colour cut by each one's colour, where it faces
  // the way each comes from (all over, one from all round); what it emits isn't.
  for (int i = 0; i < MAX_SHADES; i++) {
    if (i < uShadeCount && uShadeStrength[i] > 0.0) {
      float facing = dot(uShadeDir[i], uShadeDir[i]) > 0.0
        ? pow(max(0.0, dot(normalize(vNormal), uShadeDir[i])), uShadeSoftness[i])
        : 1.0;
      base *= 1.0 - uShadeStrength[i] * facing * uShadeColor[i];
    }
  }
#endif
  vec3 glow = emissive.rgb * uEmissiveMult;
  // The emissive pattern cut: what is below the cut goes black, the rest keeps its range.
  if (uCut > 0.0) glow = max(glow - uCut, 0.0) / (1.0 - uCut);
  // A grid shines brighter, and blooms more, where its glowing activation activates it.
#if GRID
  float shining = uActivationCount > 0 ? activeGlow() : 0.0;
#else
  float shining = 0.0;
#endif
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

export const MESH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 iUv;
in vec2 iUv2;
in vec3 iNormal;
in vec3 iWorld;
in vec4 iColor;
vec2 vUv;
vec2 vUv2;
vec3 vNormal;
vec3 vWorld;
vec4 vColor;
${MATERIAL_GLSL}
// A mesh that is a tube (the sky's star cylinder, see \`fitTube\`): drawn as the exact tube, where
// the line from the eye through the mesh meets it, its texture round and up it as the mesh has it.
uniform bool uTube;
uniform vec4 uTubeShape; // its axis's point (x, y), its radius; up is z
uniform vec2 uTubeSpan; // its ends' heights, low and high
uniform vec4 uTubeMap; // u per turn and at the start; v per height and at height 0
void main() {
  vUv = iUv;
  vUv2 = iUv2;
  vNormal = iNormal;
  vWorld = iWorld;
  vColor = iColor;
#if TUBE
  if (uTube) {
    vec3 d = normalize(iWorld - uEye);
    vec2 o = uEye.xy - uTubeShape.xy;
    float a = dot(d.xy, d.xy);
    float b = dot(o, d.xy);
    float c = dot(o, o) - uTubeShape.z * uTubeShape.z;
    float t = (-b + sqrt(max(b * b - a * c, 0.0))) / max(a, 1e-9);
    vec3 at = uEye + t * d;
    vec2 round_ = at.xy - uTubeShape.xy;
    float turn = atan(round_.y, round_.x) / (2.0 * 3.14159265);
    vUv = vec2(uTubeMap.x * turn + uTubeMap.y, uTubeMap.z * at.z + uTubeMap.w);
    vNormal = -vec3(normalize(round_), 0.0);
    vWorld = at;
    // Cut off at its ends, smoothed over a pixel (its cover reaches past them).
    float inside = min(at.z - uTubeSpan.x, uTubeSpan.y - at.z);
    coverage = clamp(inside / max(fwidth(inside), 1e-6) + 0.5, 0.0, 1.0);
  }
#endif
  shade();
  if (uOutput == 1) outColor = outGlow;
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
export const BODY_VERTEX = `#version 300 es
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

/** How many bodies' surfaces a shape part is hidden behind at most (the nearest first). */
export const MAX_SURFACES = 16;

export const BODY_FRAGMENT = `#version 300 es
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
uniform vec3 uShapeParams, uShapeCentre, uShapeAxis, uShapeUp;
// A frustum's (a tube's, a cone's) radius at its low end and its high, and its ends' heights along
// its axis; a disc's inner and outer radius.
uniform vec4 uShapeSpan;
// The bodies' surfaces (their spheres, in the world) a shape is hidden behind: a painted planet's
// parts are blended, so leave no depth to hide it.
uniform vec4 uSurfaces[${MAX_SURFACES}];
uniform int uSurfaceCount;
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
  if (m.kind == 3) {
    // Round an axis: u by the angle from the meridian, v along the axis or out from it.
    float h = dot(p, m.pole);
    vec3 r = p - h * m.pole;
    float az = atan(dot(r, cross(m.pole, m.meridian)), dot(r, m.meridian)) / (2.0 * PI);
    float along = m.b.y > 0.5 ? length(r) : h;
    return vec2(m.a.y + (m.a.x > 0.5 ? -az : az) * m.b.x, (along - m.a.z) / (m.a.w - m.a.z));
  }
  float az = abs(mod(atan(p.z, p.x) - m.a.x + PI, 2.0 * PI) - PI);
  // v: nothing at both edges, all at the circle a.z of the way across (as the mesh has it).
  float mid = clamp(m.a.z, 0.001, 0.999);
  return vec2(m.a.y * (1.0 - az / PI), across < mid ? across / mid : (1.0 - across) / (1.0 - mid));
}
// Where the eye's ray d meets a frustum (or a disc) about uShapeAxis through uShapeCentre: its
// distance along the ray (the nearer wall, or the farther one), and how far inside the shape's
// edges the point is (each edge's own measure, so each smooths over its own pixel).
float frustum(vec3 eye, vec3 d, bool far, out vec3 edges) {
  vec3 ax = uShapeAxis;
  vec3 o = eye - uShapeCentre;
  float oh = dot(o, ax), dh = dot(d, ax);
  vec3 oP = o - oh * ax, dP = d - dh * ax;
  float m = (uShapeSpan.y - uShapeSpan.x) / max(uShapeSpan.w - uShapeSpan.z, 1e-6);
  float ro = m * (oh - uShapeSpan.z) + uShapeSpan.x;
  float a = dot(dP, dP) - m * m * dh * dh;
  float b = dot(oP, dP) - m * dh * ro;
  float disc = b * b - a * (dot(oP, oP) - ro * ro);
  float s = sqrt(max(disc, 0.0));
  float t1 = (-b - s) / a, t2 = (-b + s) / a;
  float t = far ? max(t1, t2) : min(t1, t2);
  float h = oh + t * dh;
  edges = vec3(disc, h - uShapeSpan.z, uShapeSpan.w - h);
  return t;
}
float flatDisc(vec3 eye, vec3 d, out vec3 edges) {
  vec3 ax = uShapeAxis;
  float t = dot(uShapeCentre - eye, ax) / dot(d, ax);
  vec3 q = eye + t * d - uShapeCentre;
  float r = length(q - dot(q, ax) * ax);
  edges = vec3(1.0, r - uShapeSpan.x, uShapeSpan.y - r);
  return t;
}
// A flat rectangle square to uShapeAxis, uShapeSpan.x wide and .y high (high along uShapeUp).
float flatRect(vec3 eye, vec3 d, out vec3 edges) {
  vec3 ax = uShapeAxis;
  vec3 right = cross(uShapeUp, ax);
  float t = dot(uShapeCentre - eye, ax) / dot(d, ax);
  vec3 q = eye + t * d - uShapeCentre;
  edges = vec3(1.0, uShapeSpan.x * 0.5 - abs(dot(q, right)), uShapeSpan.y * 0.5 - abs(dot(q, uShapeUp)));
  return t;
}
// A capsule about uShapeAxis: a tube of radius uShapeSpan.x from height .z to .w, closed by half
// spheres; where the ray meets it (nearer, or farther: its inside), its normal there, and how far
// inside its outline the ray passes (the radius less how near it comes to the axis's segment).
float capsule(vec3 eye, vec3 d, bool far, out vec3 edges, out vec3 normal) {
  vec3 ax = uShapeAxis;
  float r = uShapeSpan.x;
  vec3 o = eye - uShapeCentre;
  vec3 a0 = ax * uShapeSpan.z, a1 = ax * uShapeSpan.w;
  vec3 seg = a1 - a0;
  vec3 w0 = o - a0;
  float b = dot(d, seg), c = dot(seg, seg), e = dot(seg, w0), dd = dot(d, w0);
  float den = c - b * b;
  float s = clamp(den > 1e-9 ? (e - b * dd) / den : 0.0, 0.0, 1.0);
  vec3 onAxis = a0 + s * seg;
  float near = dot(onAxis - o, d);
  edges = vec3(r - length(o + near * d - onAxis), 1.0, 1.0);
  float best = far ? -1.0 : 1e20;
  normal = vec3(0.0, 0.0, 1.0);
  // Its straight part.
  float oh = dot(o, ax), dh = dot(d, ax);
  vec3 oP = o - oh * ax, dP = d - dh * ax;
  float qa = dot(dP, dP), qb = dot(oP, dP), qc = dot(oP, oP) - r * r;
  float disc = qb * qb - qa * qc;
  if (disc > 0.0 && qa > 1e-9) {
    for (int k = 0; k < 2; k++) {
      float t = (-qb + (k == 0 ? -1.0 : 1.0) * sqrt(disc)) / qa;
      float h = oh + t * dh;
      if (t > 0.0 && h >= uShapeSpan.z && h <= uShapeSpan.w && (far ? t > best : t < best)) {
        best = t;
        vec3 q = o + t * d;
        normal = normalize(q - dot(q, ax) * ax);
      }
    }
  }
  // Its two ends.
  for (int end = 0; end < 2; end++) {
    vec3 cap = end == 0 ? a0 : a1;
    vec3 oc = o - cap;
    float cb = dot(oc, d);
    float cd = cb * cb - (dot(oc, oc) - r * r);
    if (cd <= 0.0) continue;
    for (int k = 0; k < 2; k++) {
      float t = -cb + (k == 0 ? -1.0 : 1.0) * sqrt(cd);
      float h = dot(o + t * d, ax);
      bool beyond = end == 0 ? h <= uShapeSpan.z : h >= uShapeSpan.w;
      if (t > 0.0 && beyond && (far ? t > best : t < best)) {
        best = t;
        normal = (oc + t * d) / r;
      }
    }
  }
  return best > 0.0 && best < 1e19 ? best : -1.0;
}
// How much of a point (in the body's frame) is seen past the bodies' surfaces: none where one is
// between it and the eye (its edge smoothed over a pixel), or it is inside one. (A pixel's size
// is taken before the loop: derivatives in it aren't to be relied on.)
float pastSurfaces(vec3 eye, vec3 at) {
  vec3 from = uCentre + uAxes * (eye * uRadius);
  vec3 ray = uCentre + uAxes * (at * uRadius) - from;
  float far = max(length(ray), 1e-6);
  vec3 d = ray / far;
  // A pixel's angle across, from the eye.
  float pixel = max(length(fwidth(d)), 1e-7);
  float seen = 1.0;
  for (int i = 0; i < ${MAX_SURFACES}; i++) {
    if (i >= uSurfaceCount) break;
    vec4 s = uSurfaces[i];
    vec3 to = s.xyz - from;
    float along = dot(to, d);
    // Out from its outline as seen (where its middle is nearer than the point), else out from
    // it: in pixels where it is.
    float edge = along < far
      ? (length(to - along * d) - s.w) / (pixel * max(along, 1e-6))
      : (length(to - ray) - s.w) / (pixel * far);
    seen *= clamp(edge + 0.5, 0.0, 1.0);
  }
  return seen;
}
void main() {
  vec3 eye = uEye;
  vec3 d = normalize(vec3(vQuad.x, 0.0, vQuad.y) / uRadius - eye);
  // Where the ray meets the part's shape (p, in its frame), its normal there, and how far across a
  // ring it is: each shape worked out on its own, then all shaded by the one tail below (the
  // material written out once more for a shape alone doubles how long Direct3D takes to compile
  // the shader, the whole browser held up meanwhile).
  vec3 p, n;
  bool sphere = true;
  float across = 0.0;
  if (uShape >= 3) {
    // A tube, a cone (the nearer wall, 3, or the farther, 4: its inside), a disc (5), a plane (6)
    // or a capsule (its outside, 7, or its inside, 8).
    vec3 edges;
    vec3 capsuleNormal;
    float t = uShape == 5
      ? flatDisc(eye, d, edges)
      : uShape == 6
        ? flatRect(eye, d, edges)
        : uShape >= 7
          ? capsule(eye, d, uShape == 8, edges, capsuleNormal)
          : frustum(eye, d, uShape == 4, edges);
    vec3 cover = clamp(edges / max(fwidth(edges), vec3(1e-6)) + 0.5, 0.0, 1.0);
    // (Before any pixel is let go: each smooths its edges with its neighbours'.)
    coverage = min(cover.x, min(cover.y, cover.z)) * pastSurfaces(eye, eye + abs(t) * d);
    if (t <= 0.0) discard;
    p = eye + t * d - uShapeCentre;
    vec3 ax = uShapeAxis;
    if (uShape == 5 || uShape == 6) n = dot(d, ax) < 0.0 ? ax : -ax;
    else if (uShape >= 7) n = uShape == 7 ? capsuleNormal : -capsuleNormal;
    else {
      float m = (uShapeSpan.y - uShapeSpan.x) / max(uShapeSpan.w - uShapeSpan.z, 1e-6);
      vec3 out_ = normalize(normalize(p - dot(p, ax) * ax) - m * ax);
      n = uShape == 3 ? out_ : -out_;
    }
    vWorld = p + uShapeCentre;
  } else {
    // A sphere (near side 0, far side 1) or a ring (2).
    sphere = uShape <= 1;
    // Each shape's edge smoothed over a pixel: how far inside it the pixel is, over how much that
    // changes across the pixel (worked out for every pixel of the square, before any is dropped).
    float r = uShapeParams.x;
    vec3 from = eye - uShapeCentre;
    float b = dot(from, d);
    float disc = b * b - dot(from, from) + r * r;
    float tRing = (uShapeParams.z - eye.y) / d.y;
    float rr = length((eye + tRing * d).xz);
    float inside = sphere ? disc : min(rr - uShapeParams.x, uShapeParams.y - rr);
    coverage = clamp(inside / max(fwidth(inside), 1e-6) + 0.5, 0.0, 1.0);
    // A pixel the shape misses isn't dropped (its neighbours' texture derivatives need it: a
    // dropped one leaves them undefined, and the textures alias along the edge); it is shaded as
    // the edge and given nothing, below.
    if (sphere) {
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
      across = (length(p.xz) - uShapeParams.x) / max(1e-5, uShapeParams.y - uShapeParams.x);
    }
    vWorld = p;
  }
  vNormal = n;
  vColor = uPartColor;
  vec3 at = sphere ? p + uShapeCentre : p;
  vec4 clip = uViewProjection * vec4(uCentre + uAxes * (at * uRadius), 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  if (!sphere) {
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
  if (uOutput == 1) outColor = outGlow;
}`;

/**
 * A particle as a square facing the camera, its size its side (the brightest stars then come out
 * as wide, and as many, as in a screenshot of the game); streaked across the view while the
 * background flies to another set of planets (uStreak, 0 to 1): drawn out to STREAK_LENGTH times
 * its size, thinned and dimmed as it goes, as a star smears when the view sweeps.
 */
export const PARTICLE_VERTEX = `#version 300 es
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

export const PARTICLE_FRAGMENT = `#version 300 es
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
${BLEND_GLSL}
${TINT_GLSL}
void main() {
  vec4 t = texture(uTexture, vUv);
  vec3 c = uChannel <= 1 ? t.rgb : vec3(uChannel == 2 ? t.a : uChannel == 3 ? t.r : uChannel == 4 ? t.g : t.b);
  vec3 star = tintBy(c * uBright * vColor.rgb, uBodyTintColor, uBodyTintBlend, uBodyTintStrength);
  outColor = vec4(star * vColor.a, 0.0);
}`;

export const TONE_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * A layer drawn on its own (premultiplied: its alpha what it covers), over the frame, covering
 * what is under it as far as its alpha says.
 */
export const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uColor;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {
  outColor = texture(uColor, vUv);
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
export const BLOOM_FRAGMENT = `#version 300 es
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
 * The light's HDR tone mapping: the scene scaled by its exposure, its luminance through Reinhard's
 * curve to the light's white point (what reaches it shows as white). The data gives the exposure
 * and white point but not the curve (its operator is a number); on luminance this one matches the
 * game's screenshot within a few levels, where the same curve per channel darkens the blues too much.
 * Then the tint, as CSS blends a colour over the picture: fading from the tint before (uTint[1])
 * to the tint now (uTint[0]) by uFade.
 */
export const TONE_FRAGMENT = `#version 300 es
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

/** How many bodies' spheres a beam is hidden behind at most (the nearest first). */
export const MAX_BEAM_SPHERES = 16;

/**
 * A light's beam (see `scene-beams.ts`), over the picture as shown: its tube put round its way,
 * from the body's middle out; hidden where the scene is nearer (its depth, as drawn).
 */
export const BEAM_VERTEX = `#version 300 es
in vec3 aTube;
uniform mat4 uViewProjection;
uniform vec3 uCentre, uWay, uAcross, uUp;
uniform float uRadius, uLength;
out vec3 vAt, vNormal;
out float vAlong;
void main() {
  vNormal = uAcross * aTube.x + uUp * aTube.y;
  vAt = uCentre + vNormal * uRadius + uWay * aTube.z * uLength;
  vAlong = aTube.z;
  gl_Position = uViewProjection * vec4(vAt, 1.0);
}`;

/**
 * A beam's colour where it is seen: strongest down its middle (where the eye looks through most
 * of it) and near its body, fading out to its far end; or (`uEdge`) only along its edges, faintly
 * (a dark beam's, to show on a dark sky). None behind what the scene has nearer (its depth), nor
 * behind or inside a body (its sphere: a painted planet's parts are blended, so leave no depth),
 * nor over its own body at all (a light from in front would wash it out).
 */
export const BEAM_FRAGMENT = `#version 300 es
precision highp float;
#define MAX_SPHERES ${MAX_BEAM_SPHERES}
uniform highp sampler2D uDepth;
uniform vec3 uEye, uColor;
uniform float uAlpha;
uniform bool uEdge;
uniform vec4 uSpheres[MAX_SPHERES], uBody;
uniform int uSphereCount;
in vec3 vAt, vNormal;
in float vAlong;
out vec4 outColor;
// Where the line of sight from the eye along d meets a sphere first (none: -1).
float meets(vec4 sphere, vec3 d) {
  vec3 oc = uEye - sphere.xyz;
  float b = dot(oc, d);
  float disc = b * b - (dot(oc, oc) - sphere.w * sphere.w);
  return disc > 0.0 ? -b - sqrt(disc) : -1.0;
}
// Whether its own body is seen here at all, or another body's sphere is between the eye and here
// (or here is inside it).
bool hidden() {
  vec3 ray = vAt - uEye;
  float far = length(ray);
  vec3 d = ray / far;
  if (meets(uBody, d) > 0.0) return true;
  for (int i = 0; i < MAX_SPHERES; i++) {
    if (i >= uSphereCount) break;
    float near = meets(uSpheres[i], d);
    if (near > 0.0 && near < far) return true;
  }
  return false;
}
void main() {
  if (gl_FragCoord.z > texelFetch(uDepth, ivec2(gl_FragCoord.xy), 0).r) discard;
  if (hidden()) discard;
  float facing = abs(dot(normalize(vNormal), normalize(uEye - vAt)));
  float a = uAlpha * (uEdge ? pow(1.0 - facing, 8.0) : facing) * (1.0 - vAlong);
  outColor = vec4(uColor * a, a);
}`;

/** A shader's source with these switches defined (each 0 or 1, or a number), after its version. */
export function withDefines(
  source: string,
  defines: Readonly<Record<string, number | boolean>>,
): string {
  const [version, ...rest] = source.split('\n');
  const lines = Object.entries(defines).map(([k, v]) => `#define ${k} ${+v}`);
  return [version, ...lines, ...rest].join('\n');
}

/** The bodies' shader: everything a part can be drawn with compiled in. */
export function bodyFragment(): string {
  return withDefines(BODY_FRAGMENT, {
    GRID: true,
    PATTERN: true,
    LIT: true,
    SHADES: true,
    SMEAR: false,
    TUBE: false,
  });
}

/** The meshes' shader (the sky's): smeared in a fly; a tube's drawn as the exact tube. */
export function meshFragment(tube: boolean): string {
  return withDefines(MESH_FRAGMENT, {
    GRID: false,
    PATTERN: false,
    LIT: false,
    SHADES: false,
    SMEAR: true,
    TUBE: tube,
  });
}

/** A rectangle of the frame (in normalized device coordinates: x0, y0, x1, y1) a baked body covers. */
export const IMPOSTOR_VERTEX = `#version 300 es
uniform vec4 uRect;
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  gl_Position = vec4(mix(uRect.xy, uRect.zw, corner), 0.0, 1.0);
}`;

/**
 * A body baked (drawn on its own into a target the size of the rectangle it covers, each pixel
 * the frame's), put back into the frame pixel for pixel: its colour, or its glow from its glow
 * bake (premultiplied: over what is there as far as it covers, its added light added), at the
 * depth it was drawn at. Pass 0 gives
 * the frame its opaque pixels' depths (as drawing it would); pass 1 its colour, tested at its
 * depth where it has one, else at its nearest (an added light has none: in front of what it is
 * in front of).
 */
export const IMPOSTOR_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform highp sampler2D uDepth;
uniform ivec2 uOrigin;
uniform float uFront;
uniform int uPass;
layout(location = 0) out vec4 outColor;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy) - uOrigin;
  vec4 colour = texelFetch(uColor, at, 0);
  float depth = texelFetch(uDepth, at, 0).r;
  if (uPass == 0) {
    if (depth >= 1.0 || colour.a < 0.999) discard;
    gl_FragDepth = depth;
    outColor = vec4(0.0);
    return;
  }
  if (colour == vec4(0.0)) discard;
  gl_FragDepth = depth < 1.0 ? depth : uFront;
  outColor = colour;
}`;
