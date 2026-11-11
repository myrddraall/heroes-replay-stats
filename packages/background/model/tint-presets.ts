import type { TintPreset } from "@myrddraall/heroes-replay-stats-aether";
/** The site's tints for the background, each colour one of the theme's custom properties. */
export const PRESETS: readonly TintPreset[] = [
  { id: 'purple', label: 'None', token: null, blend: 'multiply' },
  {
    id: 'blue-multiply',
    label: 'Blue (multiply)',
    token: '--hrs-background-tint-blue',
    blend: 'multiply',
  },
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
