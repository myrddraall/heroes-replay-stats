import type { BackgroundTints, TintBlend } from '../../scenes/play-background/scene-tints';
export { BLENDS } from '../../scenes/play-background/scene-tints';
export { PRESETS, type TintPreset } from '../../scenes/play-background/tint-presets';

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

/** The background's tints the settings make (a part switched off has none of its own). */
export function backgroundTints(settings: TintSettings): BackgroundTints {
  const tint = (part: Part) => {
    const { on, colour, blend } = settings[part];
    return on ? { colour, blend } : null;
  };
  const planets: Partial<Record<Exclude<Part, 'background'>, { colour: string; blend: TintBlend }>> = {};
  for (const size of ['large', 'medium', 'small'] as const) {
    const own = tint(size);
    if (own) planets[size] = own;
  }
  return { background: tint('background'), planets };
}
