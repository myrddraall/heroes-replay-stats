import { InjectionToken } from '@angular/core';
import { NO_TINTS, type TintBlend, type ViewTints } from './tints';

/**
 * A tint for the whole picture, by the custom property holding its colour (none: untinted, the
 * game's own colours).
 */
export interface TintPreset {
  /** What it is kept as in the settings. */
  readonly id: string;
  readonly label: string;
  readonly token: string | null;
  readonly blend: TintBlend;
}

/** The tints a scene's tint can be chosen from, the first untinted; an app provides its own. */
export const TINT_PRESETS = new InjectionToken<readonly TintPreset[]>('TINT_PRESETS', {
  providedIn: 'root',
  factory: () => [{ id: 'none', label: 'None', token: null, blend: 'multiply' }],
});

/** The tints a preset makes, its colour read from `root`'s custom property. */
export function presetTints(preset: TintPreset, root: Element): ViewTints {
  if (!preset.token) return NO_TINTS;
  return { background: { colour: presetColour(preset, root), blend: preset.blend } };
}

/** A preset's colour as `root` has it (untinted: white). */
export function presetColour(preset: TintPreset, root: Element): string {
  return preset.token ? getComputedStyle(root).getPropertyValue(preset.token).trim() : '#ffffff';
}
