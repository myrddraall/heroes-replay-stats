import { without } from './scene-settings';
import type { MaterialSettings } from '../materials/material-settings';
import type { BodySettings } from '../bodies/body-settings';

/** Settings with one material's changed. */
export function withMaterial(
  s: BodySettings,
  name: string,
  change: Partial<MaterialSettings>,
): BodySettings {
  return { ...s, materials: { ...s.materials, [name]: { ...s.materials?.[name], ...change } } };
}

/** Settings with one material's taken back (all of it: `keys` left out); none left: none at all. */
export function withoutMaterial(
  s: BodySettings,
  name: string,
  keys?: readonly (keyof MaterialSettings)[],
): BodySettings | undefined {
  const materials = { ...s.materials };
  const left = keys ? without(materials[name], keys) : undefined;
  if (left) materials[name] = left;
  else delete materials[name];
  return without({ ...s, materials }, Object.keys(materials).length ? [] : ['materials']);
}

/**
 * Settings with a material switched on or off: back to what is under this level (`below`) where
 * that is the same (not set here), else set here.
 */
export function withMaterialSwitched(
  s: BodySettings,
  name: string,
  on: boolean,
  below: boolean,
): BodySettings | undefined {
  return on === below
    ? withoutMaterial(s, name, ['enabled'])
    : withMaterial(s, name, { enabled: on });
}
