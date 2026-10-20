import {
  type MaterialControls,
  materialControls,
  type MaterialValues,
  materialValues,
  mergeMaterialSettings,
  NO_MATERIAL_TINT,
  originsOf,
  type SettingOrigins,
} from '../../../scenes/play-background/material-settings';
import {
  PLAY_SCENE_URL,
  type SceneMaterial,
  type SceneTexture,
} from '../../../scenes/play-background/play-scene';
import type {
  BodySettings,
  BodyValues,
  MoonChoices,
  Orbit,
  SkyChoices,
  Vec3,
} from '../../../scenes/play-background/background-scene';
import { keyLightFrom, TOWARDS_EYE } from '../../../scenes/play-background/scene-directions';
import { materialLabel } from '../../../scenes/play-background/material-names';
import { REFERENCE_KEY } from './editing-aids.store';
import type { TreeRow } from './scene-tree';
import {
  DEFAULT_SHADE,
  type MaterialSettings,
  type MaterialSettingsMap,
  type MaterialTint,
  type PartRole,
  type PlanetFile,
  wearOf,
  withMasks,
} from '../../../scenes/play-background/scene-planets';

/**
 * What an editor of the background's design shows, whichever layer it edits (a scene, over the
 * library; the library, over the game data): a body's and a material's values through the layers,
 * and what is set in the layer edited.
 */

/** What a tree row is, for the properties shown when it is selected. */
export type TargetKind =
  | 'scene'
  | 'sky'
  | 'sky-material'
  | 'body'
  | 'material'
  | 'particle'
  | 'backdrop'
  | 'stand-in'
  | 'reference'
  | 'group';

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
  /** The materials' base settings (the library's), under its own. */
  readonly materialBase?: MaterialSettingsMap;
  readonly file?: PlanetFile;
  readonly styleFile?: PlanetFile;
  /** Its orbit, where it is a moon in a scene. */
  readonly orbit?: Orbit;
  /** Where it is and how big, where it is one of a scene's planets. */
  readonly place?: { readonly position: Vec3; readonly radius: number };
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
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof BodySettings>;
}

/** A texture a material's layer reads: which layer, where the site has it, where the game data has it. */
export interface TextureEntry {
  readonly layer: string;
  /** Its path on the site. */
  readonly path: string;
  /** Its path in the game data, where the export says. */
  readonly source?: string;
  readonly baked: boolean;
  readonly width: number;
  readonly height: number;
}

/** A material as its properties show it: its settings as shown, what is set in the layer edited, which controls do anything, the textures it reads. */
export interface MaterialEntry {
  /** Its name in the game data (what settings are kept by). */
  readonly name: string;
  /** Its name as people read it (`materialLabel`). */
  readonly label: string;
  /** Whose it is: the body's own, or the style it wears. */
  readonly from: 'own' | 'style';
  /** Where it comes from, in words, where it isn't the body's own (a style's: which, and for whom). */
  readonly origin?: string;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof MaterialSettings>;
  readonly values: MaterialValues;
  readonly controls: MaterialControls;
  readonly set: MaterialSettings | undefined;
  readonly baseTint: MaterialTint;
  readonly textures: readonly TextureEntry[];
}

/** The textures a material's layers read, in its layers' order. */
export function texturesOf(
  material: SceneMaterial,
  textures: Readonly<Record<string, SceneTexture>>,
): TextureEntry[] {
  const layers = [
    ['Diffuse', material.diffuse],
    ['Emissive', material.emissive],
    ...material.alphaMasks.map(
      (m, i) => [material.alphaMasks.length > 1 ? `Mask ${i + 1}` : 'Mask', m] as const,
    ),
  ] as const;
  const out: TextureEntry[] = [];
  for (const [layer, l] of layers) {
    const texture = l?.texture ? textures[l.texture] : undefined;
    if (!texture) continue;
    out.push({
      layer,
      path: `${PLAY_SCENE_URL}${texture.file}`,
      source: texture.source,
      baked: texture.baked ?? false,
      width: texture.width,
      height: texture.height,
    });
  }
  return out;
}

/** A material of a planet's (or style's) parts: whether a pattern is drawn for it, and its part's role. */
export interface PartMaterial {
  readonly name: string;
  readonly material: SceneMaterial;
  readonly pattern: boolean;
  readonly role: PartRole;
}

/** A planet's (or style's) materials, in its parts' order, each once (with its first part's role). */
export function partMaterials(file: PlanetFile): PartMaterial[] {
  const out: PartMaterial[] = [];
  for (const part of file.parts)
    for (const name of part.materials) {
      const material = file.materials[name];
      if (material && !out.some((m) => m.name === name))
        out.push({ name, material, pattern: part.pattern !== undefined, role: part.role });
    }
  return out;
}

/**
 * A body's materials, its own then its style's, as shown: each through its file's tuning (and how
 * the body wears its style), the defaults under the layer edited, and the layer edited.
 */
export function materialsOf(b: BodyInfo): MaterialEntry[] {
  const chosen = b.settings.materials;
  const worn = wearOf(b.file, b.style)?.materials;
  const owners: [PlanetFile | undefined, BodySettings | undefined, 'own' | 'style'][] = [
    [b.file, b.below, 'own'],
    [b.styleFile, b.styleBelow, 'style'],
  ];
  return owners.flatMap(([owner, below, from]) =>
    owner
      ? partMaterials(owner).map(({ name, material, pattern, role }) => {
          const layers = [owner.tuning?.materials, worn, b.materialBase, below?.materials] as const;
          const names = [
            from === 'style' ? `the ${b.style} style` : 'its tuning',
            `${b.id}'s tuning for ${b.style}`,
            'the library (material)',
            from === 'style' ? `the library (${b.style})` : 'the library (planet)',
          ];
          const under = mergeMaterialSettings(...layers)[name];
          const settings = mergeMaterialSettings(...layers, chosen)[name];
          const values = materialValues(material, settings);
          return {
            name,
            label: materialLabel(name, material, owner.textures, role),
            from,
            origin: from === 'style' ? `From the ${b.style} style, set for ${b.id}` : undefined,
            origins: originsOf(layers.map((l, i) => [names[i]!, l?.[name]] as const)),
            values,
            controls: materialControls(material, pattern, false, values.drawAs),
            set: chosen?.[name],
            baseTint: under?.tint ?? NO_MATERIAL_TINT,
            // The textures it reads as worn here (a body's own masks on a style's material).
            textures: texturesOf(withMasks(material, settings?.masks), {
              ...owner.textures,
              ...b.file?.textures,
            }),
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
  const wear = wearOf(b.file, b.style)?.shade;
  return {
    style: b.style,
    lighting: s.lighting ?? own?.lighting ?? tuning?.lighting ?? 1,
    // A style it wears shades it its way (as it wears it); else its own.
    shade:
      s.shade ??
      styled?.shade ??
      own?.shade ??
      wear?.strength ??
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
      wear?.direction ??
      style?.shade?.direction ??
      tuning?.shade?.direction ??
      DEFAULT_SHADE.direction,
    rim: s.rim ?? own?.rim ?? tuning?.rim ?? TOWARDS_EYE,
  };
}

/**
 * Which level under the one edited sets each of a body's settings, as `valuesOf` resolves them:
 * the first that sets it, from the nearest down (a style it wears over its own, as it shades).
 */
export function bodyOrigins(b: BodyInfo): SettingOrigins<keyof BodySettings> {
  const tuning = b.file?.tuning;
  const style = b.styleFile;
  const own = b.below;
  const styled = b.styleBelow;
  const wear = wearOf(b.file, b.style)?.shade;
  const first = (...levels: [string, unknown][]) => levels.find(([, v]) => v !== undefined)?.[0];
  const library = 'the library (planet)';
  const libraryStyle = `the library (${b.style})`;
  const worn = `its tuning for ${b.style}`;
  const styleOwn = `the ${b.style} style`;
  const out: SettingOrigins<keyof BodySettings> = {
    lighting: first([library, own?.lighting], ['its tuning', tuning?.lighting]),
    shade: first(
      [libraryStyle, styled?.shade],
      [library, own?.shade],
      [worn, wear?.strength],
      [styleOwn, style?.shade?.strength],
      ['its tuning', tuning?.shade?.strength],
    ),
    tint: first([library, own?.tint], ['its tuning', tuning?.tint]),
    lightFrom: first([library, own?.lightFrom], ['its tuning', tuning?.lightFrom]),
    shadeTowards: first(
      [libraryStyle, styled?.shadeTowards],
      [library, own?.shadeTowards],
      [worn, wear?.direction],
      [styleOwn, style?.shade?.direction],
      ['its tuning', tuning?.shade?.direction],
    ),
    rim: first([library, own?.rim], ['its tuning', tuning?.rim]),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as SettingOrigins<
    keyof BodySettings
  >;
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
    origins: bodyOrigins(b),
  };
}

/** The sky's materials as shown: the scene file's, through what is under the layer edited and the layer edited. */
export function skyMaterialsOf(
  scene: {
    readonly meshes: Readonly<
      Record<string, { readonly planet?: unknown; readonly materials: readonly string[] }>
    >;
    readonly materials: Readonly<Record<string, SceneMaterial>>;
    readonly textures: Readonly<Record<string, SceneTexture>>;
    readonly particles: readonly { readonly material: string }[];
  },
  below: SkyChoices | undefined,
  edited: SkyChoices | undefined,
  base?: MaterialSettingsMap,
): MaterialEntry[] {
  const out: MaterialEntry[] = [];
  const meshes = Object.values(scene.meshes)
    .filter((mesh) => !mesh.planet) // the scene's own planets are placed planets
    .flatMap((mesh) => mesh.materials.map((name) => ({ name, particles: false })));
  const particles = scene.particles.map((p) => ({ name: p.material, particles: true }));
  for (const { name, particles: drawn } of [...meshes, ...particles]) {
    const material = scene.materials[name];
    if (!material || out.some((m) => m.name === name)) continue;
    const under = mergeMaterialSettings(base, below?.materials)[name];
    out.push({
      name,
      label: materialLabel(name, material, scene.textures),
      from: 'own',
      origins: originsOf([
        ['the library (material)', base?.[name]],
        ['the library (sky)', below?.materials?.[name]],
      ]),
      values: materialValues(
        material,
        mergeMaterialSettings(base, below?.materials, edited?.materials)[name],
      ),
      controls: materialControls(material, false, drawn),
      set: edited?.materials?.[name],
      baseTint: under?.tint ?? NO_MATERIAL_TINT,
      textures: texturesOf(material, scene.textures),
    });
  }
  return out;
}

/**
 * A material on its own, as its base settings show it: the data's, through the tuning of the
 * asset it is shown from, under its base settings.
 */
export function baseMaterialOf(
  name: string,
  material: SceneMaterial,
  textures: Readonly<Record<string, SceneTexture>>,
  pattern: boolean,
  tuning: MaterialSettingsMap | undefined,
  base: MaterialSettingsMap | undefined,
  particles = false,
  role?: PartRole,
): MaterialEntry {
  const values = materialValues(material, mergeMaterialSettings(tuning, base)[name]);
  return {
    name,
    label: materialLabel(name, material, textures, role),
    from: 'own',
    origins: originsOf([['its tuning', tuning?.[name]]]),
    values,
    controls: materialControls(material, pattern, particles, values.drawAs),
    set: base?.[name],
    baseTint: tuning?.[name]?.tint ?? NO_MATERIAL_TINT,
    textures: texturesOf(material, textures),
  };
}

/** The reference image's row: an editing aid, after what is edited, in either editor's tree. */
export const referenceRow = (): TreeRow => ({
  key: REFERENCE_KEY,
  label: 'Reference',
  icon: 'compare',
  depth: 0,
  expandable: false,
  expanded: false,
  aid: true,
});
