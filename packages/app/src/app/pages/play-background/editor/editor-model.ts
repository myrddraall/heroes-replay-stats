import {
  type MaterialControls,
  materialControls,
  type MaterialValues,
  materialValues,
  mergeMaterialSettings,
  NO_MATERIAL_TINT,
} from '../../../scenes/play-background/material-settings';
import type { SceneMaterial } from '../../../scenes/play-background/play-scene';
import type {
  BodySettings,
  BodyValues,
  MoonChoices,
  Orbit,
  SkyChoices,
} from '../../../scenes/play-background/background-scene';
import { keyLightFrom, TOWARDS_EYE } from '../../../scenes/play-background/scene-directions';
import {
  DEFAULT_SHADE,
  type MaterialSettings,
  type MaterialTint,
  type PlanetFile,
} from '../../../scenes/play-background/scene-planets';

/**
 * What an editor of the background's design shows, whichever layer it edits (a scene, over the
 * library; the library, over the game data): a body's and a material's values through the layers,
 * and what is set in the layer edited.
 */

/** What a tree row is, for the properties shown when it is selected. */
export type TargetKind = 'scene' | 'sky' | 'sky-material' | 'body' | 'material' | 'group';

/**
 * A body as an editor has it: which planet (or style), its style, its settings in the layer
 * edited and those under it, its files once loaded.
 */
export interface BodyInfo {
  /** How the editor names it (its row's key). */
  readonly key: string;
  readonly id: string;
  readonly style: string;
  /** Whether its style is chosen in the layer edited (else what is under it). */
  readonly styleSet: boolean;
  /** Its settings in the layer edited. */
  readonly settings: BodySettings;
  /** Its own defaults and its style's, under the layer edited (the library's, under a scene). */
  readonly below?: BodySettings;
  readonly styleBelow?: BodySettings;
  readonly file?: PlanetFile;
  readonly styleFile?: PlanetFile;
  /** Its orbit, where it is a moon in a scene. */
  readonly orbit?: Orbit;
  readonly moons: readonly MoonChoices[];
}

/** A body as its properties show it. */
export interface BodyView {
  readonly info: BodyInfo;
  readonly values: BodyValues;
  readonly canLight: boolean;
  /** Whether anything of it is set in the layer edited. */
  readonly changed: boolean;
  /** Its tint under the layer edited. */
  readonly baseTint: MaterialTint;
  readonly focused: boolean;
  /** Whether moons can be put about it (a scene's bodies). */
  readonly canHaveMoons: boolean;
}

/** A material as its properties show it: its settings as shown, what is set in the layer edited, which controls do anything. */
export interface MaterialEntry {
  readonly name: string;
  readonly values: MaterialValues;
  readonly controls: MaterialControls;
  readonly set: MaterialSettings | undefined;
  readonly baseTint: MaterialTint;
}

/** A planet's (or style's) materials, in its parts' order, each once, with whether a pattern is drawn for it. */
export function partMaterials(
  file: PlanetFile,
): { name: string; material: SceneMaterial; pattern: boolean }[] {
  const out: { name: string; material: SceneMaterial; pattern: boolean }[] = [];
  for (const part of file.parts)
    for (const name of part.materials) {
      const material = file.materials[name];
      if (material && !out.some((m) => m.name === name))
        out.push({ name, material, pattern: part.pattern !== undefined });
    }
  return out;
}

/**
 * A body's materials, its own then its style's, as shown: each through its file's tuning, the
 * defaults under the layer edited, and the layer edited.
 */
export function materialsOf(b: BodyInfo): MaterialEntry[] {
  const chosen = b.settings.materials;
  const owners: [PlanetFile | undefined, BodySettings | undefined][] = [
    [b.file, b.below],
    [b.styleFile, b.styleBelow],
  ];
  return owners.flatMap(([owner, below]) =>
    owner
      ? partMaterials(owner).map(({ name, material, pattern }) => {
          const under = mergeMaterialSettings(owner.tuning?.materials, below?.materials)[name];
          return {
            name,
            values: materialValues(
              material,
              mergeMaterialSettings(owner.tuning?.materials, below?.materials, chosen)[name],
            ),
            controls: materialControls(material, pattern),
            set: chosen?.[name],
            baseTint: under?.tint ?? NO_MATERIAL_TINT,
          };
        })
      : [],
  );
}

/** A body's own settings as shown: the layer edited, over those under it (its style's shade over its own), over its files' tuning, over the defaults. */
export function valuesOf(b: BodyInfo): BodyValues {
  const tuning = b.file?.tuning;
  const style = b.styleFile;
  const s = b.settings;
  const own = b.below;
  const styled = b.styleBelow;
  return {
    style: b.style,
    lighting: s.lighting ?? own?.lighting ?? tuning?.lighting ?? 1,
    // A style it wears shades it its way; else its own.
    shade:
      s.shade ??
      styled?.shade ??
      own?.shade ??
      style?.shade?.strength ??
      tuning?.shade?.strength ??
      DEFAULT_SHADE.strength,
    tint: s.tint ?? own?.tint ?? tuning?.tint ?? NO_MATERIAL_TINT,
    lightFrom:
      s.lightFrom ??
      own?.lightFrom ??
      tuning?.lightFrom ??
      keyLightFrom(style?.light ?? b.file?.light),
    shadeTowards:
      s.shadeTowards ??
      styled?.shadeTowards ??
      own?.shadeTowards ??
      style?.shade?.direction ??
      tuning?.shade?.direction ??
      DEFAULT_SHADE.direction,
    rim: s.rim ?? own?.rim ?? tuning?.rim ?? TOWARDS_EYE,
  };
}

/** A body as its properties show it, for an editor. */
export function bodyView(b: BodyInfo, focused: boolean, canHaveMoons: boolean): BodyView {
  return {
    info: b,
    values: valuesOf(b),
    canLight: !!b.file && (!!b.file.light || b.style !== ''),
    changed: Object.keys(b.settings).length > 0,
    baseTint: b.below?.tint ?? b.file?.tuning?.tint ?? NO_MATERIAL_TINT,
    focused,
    canHaveMoons,
  };
}

/** The sky's materials as shown: the scene file's, through what is under the layer edited and the layer edited. */
export function skyMaterialsOf(
  scene: {
    readonly meshes: Readonly<
      Record<string, { readonly planet?: unknown; readonly materials: readonly string[] }>
    >;
    readonly materials: Readonly<Record<string, SceneMaterial>>;
  },
  below: SkyChoices | undefined,
  edited: SkyChoices | undefined,
): MaterialEntry[] {
  const out: MaterialEntry[] = [];
  for (const mesh of Object.values(scene.meshes)) {
    if (mesh.planet) continue; // the scene's own planets are placed planets
    for (const name of mesh.materials) {
      const material = scene.materials[name];
      if (!material || out.some((m) => m.name === name)) continue;
      const under = below?.materials?.[name];
      out.push({
        name,
        values: materialValues(
          material,
          mergeMaterialSettings(below?.materials, edited?.materials)[name],
        ),
        controls: materialControls(material, false),
        set: edited?.materials?.[name],
        baseTint: under?.tint ?? NO_MATERIAL_TINT,
      });
    }
  }
  return out;
}
