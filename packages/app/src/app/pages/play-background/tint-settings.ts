import type { BackgroundTints, TintBlend } from '../../scenes/play-background/scene-tints';
export { BLENDS } from '../../scenes/play-background/scene-tints';
export { PRESETS, type TintPreset } from '../../scenes/play-background/tint-presets';

/** A tint: whether it is on, its colour (#rrggbb) and blend. */
export interface PartTint {
  readonly on: boolean;
  readonly colour: string;
  readonly blend: TintBlend;
}

/** The whole background's tint, over everything drawn (the planets' materials have their own settings). */
export interface TintSettings {
  readonly background: PartTint;
  /**
   * Which choice made it: a preset's id ('purple', the first, for none), or 'custom' (its colour
   * and blend set by hand). Kept so a custom tint stays custom where it happens to match a preset.
   */
  readonly choice?: string;
}

export const UNTINTED: TintSettings = {
  background: { on: false, colour: '#ffffff', blend: 'multiply' },
};

/** The background's tints the settings make (switched off: none). */
export function backgroundTints(settings: TintSettings): BackgroundTints {
  const { on, colour, blend } = settings.background;
  return { background: on ? { colour, blend } : null };
}
