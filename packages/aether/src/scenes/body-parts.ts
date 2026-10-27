import { without } from './scene-settings';
import { mergePartSettings, type PartSettings, type PartSettingsMap } from '../formats/part-shapes';
import type { PartKey } from '../formats/part-keys';
import type { BodySettings } from '../bodies/body-settings';

/** Settings with one part's changed (its others, and the other parts', kept). */
export function withPartSetting(
  s: BodySettings,
  key: PartKey,
  change: Partial<PartSettings>,
): BodySettings {
  return { ...s, parts: { ...s.parts, [key]: { ...s.parts?.[key], ...change } } };
}

/** Settings with one part's taken back (all of it: `keys` left out); none left: none at all. */
export function withoutPartSetting(
  s: BodySettings,
  key: PartKey,
  keys?: readonly (keyof PartSettings)[],
): BodySettings | undefined {
  const parts: Partial<Record<PartKey, PartSettings>> = { ...s.parts };
  const left = keys ? without(parts[key], keys) : undefined;
  if (left) parts[key] = left;
  else delete parts[key];
  return without({ ...s, parts }, Object.keys(parts).length ? [] : ['parts']);
}

/** A body's parts' settings in effect: under the level edited (its own defaults, its overlays'), then that level's. */
export const bodyParts = (b: {
  readonly below?: { readonly parts?: PartSettingsMap };
  readonly overlays: readonly { readonly below?: { readonly parts?: PartSettingsMap } }[];
  readonly settings: { readonly parts?: PartSettingsMap };
}): PartSettingsMap =>
  mergePartSettings(b.below?.parts, ...b.overlays.map((o) => o.below?.parts), b.settings.parts);
