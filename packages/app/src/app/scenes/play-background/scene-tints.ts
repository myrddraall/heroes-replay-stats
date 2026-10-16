/** How a tint recolours: as CSS's blend modes of those names do. */
export type TintBlend =
  | 'multiply'
  | 'color'
  | 'hue'
  | 'overlay'
  | 'soft-light'
  | 'color-burn'
  | 'saturation';

/** A colour the scene, or a part of it, is blended with; its channels 0..1. */
export interface Tint {
  readonly colour: readonly [number, number, number];
  readonly blend: TintBlend;
}

/** The planets, by their size, as the game's atmosphere materials name them. */
export const PLANETS = ['large', 'medium', 'small'] as const;
export type PlanetSize = (typeof PLANETS)[number];

/** The background's tint, then each planet's, in PLANETS' order. */
export type Tints = readonly [Tint, Tint, Tint, Tint];

/** White multiplied: the scene as the game draws it. */
export const NO_TINT: Tint = { colour: [1, 1, 1], blend: 'multiply' };
export const NO_TINTS: Tints = [NO_TINT, NO_TINT, NO_TINT, NO_TINT];

/** Each blend's number in the tone pass's shader. */
export const BLEND_MODES: Readonly<Record<TintBlend, number>> = {
  multiply: 0,
  color: 1,
  hue: 2,
  overlay: 3,
  'soft-light': 4,
  'color-burn': 5,
  saturation: 6,
};
export const BLENDS = Object.keys(BLEND_MODES) as readonly TintBlend[];

/** A CSS colour as RGB 0..1, or null when it isn't one. */
export type ColourParser = (css: string) => readonly [number, number, number] | null;

/** A tint as it is set: any CSS colour (resolved: not a `var()`), and how it blends. */
export interface PartTint {
  readonly colour: string;
  readonly blend: TintBlend;
}

/** The background's tint (none: as the game draws it), and the planets that have one of their own. */
export interface BackgroundTints {
  readonly background: PartTint | null;
  readonly planets: Readonly<Partial<Record<PlanetSize, PartTint>>>;
}

export const UNTINTED: BackgroundTints = { background: null, planets: {} };

/**
 * The tints as the renderer draws them: the background's, then each planet's (its own, or the
 * background's where it has none). A colour that isn't one tints nothing.
 */
export function rendererTints(tints: BackgroundTints, parse: ColourParser): Tints {
  const tint = (set: PartTint | null | undefined): Tint | null => {
    const colour = set ? parse(set.colour) : null;
    return colour && set ? { colour, blend: set.blend } : null;
  };
  const background = tint(tints.background) ?? NO_TINT;
  const [large, medium, small] = PLANETS.map((size) => tint(tints.planets[size]) ?? background);
  return [background, large!, medium!, small!];
}

export function sameTints(a: Tints, b: Tints): boolean {
  return a.every(
    (tint, i) =>
      tint.blend === b[i]!.blend && tint.colour.every((c, j) => c === b[i]!.colour[j]),
  );
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
 * CSS's blend modes of BLENDS (Compositing and Blending Level 1), in GLSL: `blend(b, s, mode)` is
 * backdrop b blended with source s, both 0..1, mode as BLEND_MODES numbers it.
 */
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
vec3 blend(vec3 b, vec3 s, int mode) {
  if (mode == 1) return setLum(s, lum(b));
  if (mode == 2) return setLum(setSat(s, sat(b)), lum(b));
  if (mode == 3) return hardLight(s, b); // overlay: hard light, backdrop and source swapped
  if (mode == 4) return softLight(b, s);
  if (mode == 5) return colorBurn(b, s);
  if (mode == 6) return setLum(setSat(b, sat(s)), lum(b));
  return b * s;
}`;
