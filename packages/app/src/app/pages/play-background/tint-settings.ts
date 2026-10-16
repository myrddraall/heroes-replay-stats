import type { TintBlend } from '../../scenes/play-background/scene-tints';
export { BLENDS } from '../../scenes/play-background/scene-tints';

/** What can be tinted: the whole background, and each planet on its own. */
export const PARTS = ['background', 'large', 'medium', 'small'] as const;
export type Part = (typeof PARTS)[number];

export const PART_LABELS: Readonly<Record<Part, string>> = {
  background: 'Background',
  large: 'Large planet',
  medium: 'Medium planet',
  small: 'Small planet',
};

/** A part's tint: whether it has one (a planet without follows the background), its colour (#rrggbb) and blend. */
export interface PartTint {
  readonly on: boolean;
  readonly colour: string;
  readonly blend: TintBlend;
}

export type TintSettings = Readonly<Record<Part, PartTint>>;

const OFF: PartTint = { on: false, colour: '#ffffff', blend: 'multiply' };
export const UNTINTED: TintSettings = { background: OFF, large: OFF, medium: OFF, small: OFF };

/** A tint for the whole background, by the custom property holding its colour (none: untinted). */
export interface TintPreset {
  readonly label: string;
  readonly token: string | null;
  readonly blend: TintBlend;
}

export const PRESETS: readonly TintPreset[] = [
  { label: 'Purple', token: null, blend: 'multiply' },
  { label: 'Blue (multiply)', token: '--hrs-background-tint-blue', blend: 'multiply' },
  { label: 'Blue (color)', token: '--hrs-background-tint-blue', blend: 'color' },
  { label: 'Gold (multiply)', token: '--hrs-background-tint-gold', blend: 'multiply' },
  { label: 'Green (color)', token: '--hrs-background-tint-green', blend: 'color' },
  { label: 'Red (color)', token: '--hrs-background-tint-red', blend: 'color' },
  { label: 'Red (hue)', token: '--hrs-background-tint-red', blend: 'hue' },
];

/** The custom properties the settings set on the background (null: not set). */
export function tintStyles(settings: TintSettings): Record<string, string | null> {
  const styles: Record<string, string | null> = {};
  for (const part of PARTS) {
    const name = part === 'background' ? 'background' : `planet-${part}`;
    const tint = settings[part];
    styles[`--hrs-${name}-tint`] = tint.on ? tint.colour : null;
    styles[`--hrs-${name}-tint-blend`] = tint.on ? tint.blend : null;
  }
  return styles;
}
