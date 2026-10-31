import { BLEND_GROUPS, type TintBlend } from '@myrddraall/heroes-replay-stats-aether/tints';
import { grouped, type PropertyOption } from '../controls/rows/property-select';

/** Each blend as people read it (the image editors' names, in British spelling). */
export const BLEND_LABELS: Readonly<Record<TintBlend, string>> = {
  normal: 'Normal',
  multiply: 'Multiply',
  darken: 'Darken',
  'color-burn': 'Colour burn',
  'linear-burn': 'Linear burn',
  'darker-color': 'Darker colour',
  screen: 'Screen',
  lighten: 'Lighten',
  'color-dodge': 'Colour dodge',
  'linear-dodge': 'Linear dodge (add)',
  'lighter-color': 'Lighter colour',
  overlay: 'Overlay',
  'soft-light': 'Soft light',
  'hard-light': 'Hard light',
  'vivid-light': 'Vivid light',
  'linear-light': 'Linear light',
  'pin-light': 'Pin light',
  'hard-mix': 'Hard mix',
  difference: 'Difference',
  exclusion: 'Exclusion',
  subtract: 'Subtract',
  divide: 'Divide',
  hue: 'Hue',
  saturation: 'Saturation',
  color: 'Colour',
  luminosity: 'Luminosity',
  glow: 'Glow',
  reflect: 'Reflect',
};

/** The blends as a Blend list offers them: in their groups, by their names. */
export const BLEND_OPTIONS: readonly PropertyOption[] = grouped(
  ...BLEND_GROUPS.map((g) => g.map((value) => ({ value, label: BLEND_LABELS[value] }))),
);
