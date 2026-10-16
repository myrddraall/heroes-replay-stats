import { type BackgroundTints, type TintBlend, UNTINTED } from './scene-tints';

/**
 * A tint for the whole background, by the custom property holding its colour (none: untinted, the
 * game's own purple).
 */
export interface TintPreset {
  /** What it is kept as in the settings. */
  readonly id: string;
  readonly label: string;
  readonly token: string | null;
  readonly blend: TintBlend;
}

export const PRESETS: readonly TintPreset[] = [
  { id: 'purple', label: 'Purple', token: null, blend: 'multiply' },
  { id: 'blue-multiply', label: 'Blue (multiply)', token: '--hrs-background-tint-blue', blend: 'multiply' },
  { id: 'blue-color', label: 'Blue (color)', token: '--hrs-background-tint-blue', blend: 'color' },
  { id: 'gold', label: 'Gold (multiply)', token: '--hrs-background-tint-gold', blend: 'multiply' },
  { id: 'green', label: 'Green (color)', token: '--hrs-background-tint-green', blend: 'color' },
  { id: 'red-color', label: 'Red (color)', token: '--hrs-background-tint-red', blend: 'color' },
  { id: 'red-hue', label: 'Red (hue)', token: '--hrs-background-tint-red', blend: 'hue' },
];

/** The preset kept as `id`; the first (untinted) when there is none. */
export function presetById(id: string): TintPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
}

/** The background's tints a preset makes, its colour read from `root`'s custom property. */
export function presetTints(preset: TintPreset, root: Element): BackgroundTints {
  if (!preset.token) return UNTINTED;
  const colour = getComputedStyle(root).getPropertyValue(preset.token).trim();
  return { background: { colour, blend: preset.blend }, planets: {} };
}
