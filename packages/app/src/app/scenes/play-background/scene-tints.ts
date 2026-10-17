/**
 * How a tint recolours: CSS's blend modes of those names (Compositing and Blending Level 1), and
 * the image editors' others CSS doesn't have (linear dodge and burn, vivid, linear and pin light,
 * hard mix, subtract, divide), as Photoshop defines them.
 */
export type TintBlend =
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'linear-dodge'
  | 'linear-burn'
  | 'vivid-light'
  | 'linear-light'
  | 'pin-light'
  | 'hard-mix'
  | 'difference'
  | 'exclusion'
  | 'subtract'
  | 'divide'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/** A colour the scene, or a part of it, is blended with; its channels 0..1. */
export interface Tint {
  readonly colour: readonly [number, number, number];
  readonly blend: TintBlend;
}

/** White multiplied: the scene as the game draws it. */
export const NO_TINT: Tint = { colour: [1, 1, 1], blend: 'multiply' };

/** Each blend's number in the shaders' `blend` (kept as they were: settings name blends, not numbers). */
export const BLEND_MODES: Readonly<Record<TintBlend, number>> = {
  multiply: 0,
  color: 1,
  hue: 2,
  overlay: 3,
  'soft-light': 4,
  'color-burn': 5,
  saturation: 6,
  screen: 7,
  darken: 8,
  lighten: 9,
  'color-dodge': 10,
  'hard-light': 11,
  difference: 12,
  exclusion: 13,
  luminosity: 14,
  'linear-dodge': 15,
  'linear-burn': 16,
  'vivid-light': 17,
  'linear-light': 18,
  'pin-light': 19,
  'hard-mix': 20,
  subtract: 21,
  divide: 22,
};

/** The blends in groups, as an image editor lists them: darkening, lightening, contrast, comparing, colour. */
export const BLEND_GROUPS: readonly (readonly TintBlend[])[] = [
  ['multiply', 'darken', 'color-burn', 'linear-burn'],
  ['screen', 'lighten', 'color-dodge', 'linear-dodge'],
  ['overlay', 'soft-light', 'hard-light', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix'],
  ['difference', 'exclusion', 'subtract', 'divide'],
  ['hue', 'saturation', 'color', 'luminosity'],
];

/** The blends, in BLEND_GROUPS' order. */
export const BLENDS: readonly TintBlend[] = BLEND_GROUPS.flat();

/** A CSS colour as RGB 0..1, or null when it isn't one. */
export type ColourParser = (css: string) => readonly [number, number, number] | null;

/** A tint as it is set: any CSS colour (resolved: not a `var()`), and how it blends. */
export interface PartTint {
  readonly colour: string;
  readonly blend: TintBlend;
}

/** The background's tint (none: as the game draws it). */
export interface BackgroundTints {
  readonly background: PartTint | null;
}

export const UNTINTED: BackgroundTints = { background: null };

/** The tint as the renderer draws it. A colour that isn't one tints nothing. */
export function rendererTint(tints: BackgroundTints, parse: ColourParser): Tint {
  const set = tints.background;
  const colour = set ? parse(set.colour) : null;
  return colour && set ? { colour, blend: set.blend } : NO_TINT;
}

export function sameTint(a: Tint, b: Tint): boolean {
  return a.blend === b.blend && a.colour.every((c, j) => c === b.colour[j]);
}

/**
 * A CSS colour parsed by the browser (any colour CSS takes), as RGB 0..1; a translucent one is
 * that much of the way from white (half-transparent red tints half as much).
 */
export function browserColourParser(): ColourParser {
  const context = document.createElement('canvas').getContext('2d');
  return (css) => {
    if (!css || !context) return null;
    context.fillStyle = '#000';
    context.fillStyle = css;
    const parsed = context.fillStyle;
    context.fillStyle = '#fff';
    context.fillStyle = css;
    if (parsed !== context.fillStyle) return null; // not a colour: neither default was replaced
    return parseCanvasColour(parsed);
  };
}

/** A colour as a canvas gives one back ("#rrggbb" or "rgba(r, g, b, a)"), as RGB 0..1. */
export function parseCanvasColour(value: string): readonly [number, number, number] | null {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) return [1, 2, 3].map((i) => parseInt(hex[i]!, 16) / 255) as [number, number, number];
  const rgba = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(value);
  if (!rgba) return null;
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  return [1, 2, 3].map((i) => 1 - alpha + (alpha * Number(rgba[i])) / 255) as [
    number,
    number,
    number,
  ];
}

/**
 * The blends of BLENDS in GLSL: `blend(b, s, mode)` is backdrop b blended with source s, both
 * 0..1, mode as BLEND_MODES numbers it. CSS's as Compositing and Blending Level 1 defines them;
 * the others as Photoshop does.
 */
/**
 * A tint in GLSL (after BLEND_GLSL): `tintBy(c, colour, mode, strength)` blends a colour over c as
 * the blend does, by the tint's strength; a colour past white (HDR light) is blended at its hue and
 * keeps its brightness.
 */
export const TINT_GLSL = `
vec3 tintBy(vec3 c, vec3 colour, int mode, float strength) {
  if (strength <= 0.0) return c;
  float m = max(max(c.r, c.g), c.b);
  vec3 n = m > 1.0 ? c / m : c;
  vec3 t = blend(n, colour, mode);
  return mix(c, m > 1.0 ? t * m : t, strength);
}`;

export const BLEND_GLSL = `
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColour(vec3 c) {
  float l = lum(c), n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColour(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
  return x > n ? (c - n) * s / (x - n) : vec3(0.0);
}
vec3 screen(vec3 b, vec3 s) { return b + s - b * s; }
vec3 hardLight(vec3 b, vec3 s) {
  return mix(b * 2.0 * s, screen(b, 2.0 * s - 1.0), step(0.5, s));
}
vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}
vec3 colorBurn(vec3 b, vec3 s) {
  vec3 burnt = 1.0 - min(vec3(1.0), (1.0 - b) / max(s, vec3(1e-5)));
  return mix(mix(burnt, vec3(0.0), step(s, vec3(0.0))), vec3(1.0), step(1.0, b));
}
vec3 colorDodge(vec3 b, vec3 s) {
  vec3 dodged = min(vec3(1.0), b / max(1.0 - s, vec3(1e-5)));
  return mix(mix(dodged, vec3(1.0), step(1.0, s)), vec3(0.0), step(b, vec3(0.0)));
}
vec3 vividLight(vec3 b, vec3 s) {
  return mix(colorBurn(b, 2.0 * s), colorDodge(b, 2.0 * s - 1.0), step(0.5, s));
}
vec3 pinLight(vec3 b, vec3 s) {
  return mix(min(b, 2.0 * s), max(b, 2.0 * s - 1.0), step(0.5, s));
}
vec3 blend(vec3 b, vec3 s, int mode) {
  if (mode == 1) return setLum(s, lum(b));
  if (mode == 2) return setLum(setSat(s, sat(b)), lum(b));
  if (mode == 3) return hardLight(s, b); // overlay: hard light, backdrop and source swapped
  if (mode == 4) return softLight(b, s);
  if (mode == 5) return colorBurn(b, s);
  if (mode == 6) return setLum(setSat(b, sat(s)), lum(b));
  if (mode == 7) return screen(b, s);
  if (mode == 8) return min(b, s);
  if (mode == 9) return max(b, s);
  if (mode == 10) return colorDodge(b, s);
  if (mode == 11) return hardLight(b, s);
  if (mode == 12) return abs(b - s);
  if (mode == 13) return b + s - 2.0 * b * s;
  if (mode == 14) return setLum(b, lum(s));
  if (mode == 15) return min(b + s, vec3(1.0));
  if (mode == 16) return max(b + s - 1.0, vec3(0.0));
  if (mode == 17) return vividLight(b, s);
  if (mode == 18) return clamp(b + 2.0 * s - 1.0, 0.0, 1.0);
  if (mode == 19) return pinLight(b, s);
  if (mode == 20) return step(1.0, b + s);
  if (mode == 21) return max(b - s, vec3(0.0));
  if (mode == 22) return mix(min(vec3(1.0), b / max(s, vec3(1e-5))), vec3(1.0), step(s, vec3(0.0)));
  return b * s;
}`;
