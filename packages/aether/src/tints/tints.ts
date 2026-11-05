/**
 * How a tint recolours: CSS's blend modes of those names (Compositing and Blending Level 1), and
 * the image editors' others CSS doesn't have (linear dodge and burn, vivid, linear and pin light,
 * hard mix, subtract, divide, darker and lighter colour), as Photoshop defines them; glow and
 * reflect as Krita (and Paint Shop Pro) have them. `normal`: the colour itself, by the strength.
 */
export type TintBlend =
  | 'normal'
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
  | 'luminosity'
  | 'darker-color'
  | 'lighter-color'
  | 'glow'
  | 'reflect';

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
  normal: 23,
  'darker-color': 24,
  'lighter-color': 25,
  glow: 26,
  reflect: 27,
};

/**
 * The blends in groups, as an image editor lists them: the colour itself, darkening, lightening,
 * contrast, comparing, colour; then glow and reflect (Krita's "quadratic" ones).
 */
export const BLEND_GROUPS: readonly (readonly TintBlend[])[] = [
  ['normal'],
  ['multiply', 'darken', 'color-burn', 'linear-burn', 'darker-color'],
  ['screen', 'lighten', 'color-dodge', 'linear-dodge', 'lighter-color'],
  ['overlay', 'soft-light', 'hard-light', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix'],
  ['difference', 'exclusion', 'subtract', 'divide'],
  ['hue', 'saturation', 'color', 'luminosity'],
  ['glow', 'reflect'],
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
export interface ViewTints {
  readonly background: PartTint | null;
}

export const NO_TINTS: ViewTints = { background: null };

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
