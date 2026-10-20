import {
  MATERIAL_DEFAULTS,
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
  type PlayScene,
  type SceneMaterial,
  type SceneTexture,
} from '../../../scenes/play-background/play-scene';
import { skyDepths } from '../../../scenes/play-background/sky-depths';
import {
  type BodyPath,
  type BodySettings,
  type BodyValues,
  type MoonChoices,
  type Orbit,
  type SkyChoices,
  type Vec3,
  without,
} from '../../../scenes/play-background/background-scene';
import { keyLightFrom, TOWARDS_EYE } from '../../../scenes/play-background/scene-directions';
import {
  type AddedLight,
  addedLight,
  type BodyLight,
  bodyLights,
  GRID_LIGHTS,
  type LightId,
  type LightKind,
  type LightSettings,
  type LightReach,
  type LightSettingsMap,
  lightsForMoons,
  type PartMaterials,
  type Receiver,
  mergeLightSettings,
  reachesReceiver,
  tunedRig,
  withReceiver,
} from '../../../scenes/play-background/scene-lights';
import {
  legacyShadow,
  withLightSetting,
  withLightSwitched,
  withoutLightSetting,
} from '../../../scenes/play-background/scene-bodies';
import { materialLabel, textureLabel } from '../../../scenes/play-background/material-names';
import { REFERENCE_KEY } from './editing-aids.store';
import type { TreeRow } from './scene-tree';
import {
  DEFAULT_SHADE,
  drawOrder,
  layerSlots,
  type LayerSettings,
  type LayerSlot,
  type MaterialDepth,
  type MaterialSettings,
  type MaterialSettingsMap,
  type MaterialTint,
  type PartRole,
  type PlanetFile,
  wearOf,
  wornParts,
  type BodyPart,
  mergePartSettings,
  partKey,
  type PartKey,
  type PartSettings,
  type PartSettingsMap,
  withLayer,
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
  | 'group'
  | 'part'
  | 'light';

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
  /** Whether anything of it is set in the layer edited. */
  readonly changed: boolean;
  /** Its tint under the layer edited. */
  readonly baseTint: MaterialTint;
  readonly focused: boolean;
  /** Whether moons can be put about it (a scene's bodies). */
  readonly canHaveMoons: boolean;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof BodySettings>;
  /** Its name as shown, and as the levels under the one edited have it. */
  readonly label: string;
  readonly labelBelow: string;
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
  /** Its name as shown: as renamed (the level edited's, else under it), else `materialLabel`. */
  readonly label: string;
  /** Its name as the levels under the one edited have it (what clearing a rename here gives). */
  readonly labelBelow: string;
  /** Whose it is: the body's own, or the style it wears. */
  readonly from: 'own' | 'style';
  /** Where it comes from, in words, where it isn't the body's own (a style's: which, and for whom). */
  readonly origin?: string;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof MaterialSettings>;
  readonly values: MaterialValues;
  /** Whether it is drawn as the levels under the one edited have it (switched so here: nothing set). */
  readonly enabledBelow: boolean;
  readonly controls: MaterialControls;
  readonly set: MaterialSettings | undefined;
  readonly baseTint: MaterialTint;
  /** Its layers: each one's texture and how it lies on it. */
  readonly layers: readonly LayerEntry[];
}

/** A layer's texture and how it lies on its material, as in effect (the data's where nothing is set). */
export interface LayerValues {
  readonly texture: string | undefined;
  readonly offset: readonly [number, number];
  /** Degrees. */
  readonly rotation: number;
  readonly tiling: readonly [number, number];
  /** Texture widths a second. */
  readonly scroll: readonly [number, number];
  readonly wrap: readonly [boolean, boolean];
}

/** A texture a layer may read instead: its key and its name as people read it. */
export interface TextureChoice {
  readonly key: string;
  readonly label: string;
}

/** A material's layer as its properties show it. */
export interface LayerEntry {
  readonly slot: LayerSlot;
  /** Its name: as renamed, else Diffuse, Emissive, Mask (Mask 1, Mask 2 where there are two). */
  readonly label: string;
  /** Its name as the levels under the one edited have it. */
  readonly labelBelow: string;
  readonly values: LayerValues;
  /** What of it is set in the layer edited. */
  readonly set: LayerSettings | undefined;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof LayerSettings>;
  /** The texture it reads as set, where the site and the game data have it. */
  readonly texture?: TextureEntry;
  /** The textures it may read: those loaded with what it is drawn on, by name (its own among them). */
  readonly choices: readonly TextureChoice[];
}

/**
 * A material's layers as shown: each layer's data (`material`, its masks as worn) under its
 * settings (`settings`, merged through every level; `set`, the level edited's; `levels`, the
 * levels under it by name, for where each comes from), and the textures it may read instead
 * (`choices`: by key, those of what it is drawn on and the sky's).
 */
export function layersOf(
  material: SceneMaterial,
  settings: MaterialSettings | undefined,
  set: MaterialSettings | undefined,
  levels: readonly (readonly [string, MaterialSettings | undefined])[],
  textures: Readonly<Record<string, SceneTexture>>,
): LayerEntry[] {
  const slots = layerSlots(material);
  const masks = slots.filter(([slot]) => slot.startsWith('mask')).length;
  const choices = textureChoices(textures);
  return slots.map(([slot, data]) => {
    const own = settings?.layers?.[slot];
    const layer = withLayer(data, own);
    const scroll = layer.scroll;
    const key = layer.texture;
    const info = key ? textures[key] : undefined;
    const named =
      LAYER_NAMES[slot] + (slot.startsWith('mask') && masks > 1 ? ` ${slot.slice(4)}` : '');
    const below =
      levels
        .map(([, l]) => l?.layers?.[slot]?.label)
        .filter((l) => l !== undefined)
        .at(-1) ?? named;
    return {
      slot,
      label: own?.label ?? below,
      labelBelow: below,
      values: {
        texture: key,
        offset: layer.offset ?? [0, 0],
        rotation: own?.rotation ?? ((layer.angle ?? 0) * 180) / Math.PI,
        tiling: layer.tiling ?? [1, 1],
        scroll: scroll ? [scroll.by[0] / scroll.seconds, scroll.by[1] / scroll.seconds] : [0, 0],
        wrap: layer.wrap ?? [true, true],
      },
      set: set?.layers?.[slot],
      origins: originsOf(levels.map(([name, l]) => [name, l?.layers?.[slot]] as const)),
      texture: info && key ? textureEntry(LAYER_NAMES[slot], info) : undefined,
      choices:
        key && !choices.some((c) => c.key === key)
          ? [{ key, label: textureLabel(key, info) }, ...choices]
          : choices,
    };
  });
}

const LAYER_NAMES: Record<LayerSlot, string> = {
  diffuse: 'Diffuse',
  emissive: 'Emissive',
  mask1: 'Mask',
  mask2: 'Mask',
};

/**
 * Textures to choose from, by their names as people read them: one the exporter baked onto its
 * planet's mapping says so; any two that still read alike, told apart by key.
 */
function textureChoices(textures: Readonly<Record<string, SceneTexture>>): TextureChoice[] {
  const named = Object.entries(textures).map(([key, t]) => ({
    key,
    label: textureLabel(key, t) + (t.baked ? ' (baked)' : ''),
  }));
  const count = new Map<string, number>();
  for (const c of named) count.set(c.label, (count.get(c.label) ?? 0) + 1);
  return named
    .map((c) => ((count.get(c.label) ?? 0) > 1 ? { ...c, label: `${c.label} (${c.key})` } : c))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** A texture as its properties show it: where the site and the game data have it, and its size. */
function textureEntry(layer: string, texture: SceneTexture): TextureEntry {
  return {
    layer,
    path: `${PLAY_SCENE_URL}${texture.file}`,
    source: texture.source,
    baked: texture.baked ?? false,
    width: texture.width,
    height: texture.height,
  };
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
    if (texture) out.push(textureEntry(layer, texture));
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
export function materialsOf(
  b: BodyInfo,
  sky: Readonly<Record<string, SceneTexture>> = {},
): MaterialEntry[] {
  const chosen = b.settings.materials;
  const worn = wearOf(b.file, b.style)?.materials;
  const owners: [PlanetFile | undefined, BodySettings | undefined, 'own' | 'style'][] = [
    [b.file, b.below, 'own'],
    [b.styleFile, b.styleBelow, 'style'],
  ];
  const entries = owners.flatMap(([owner, below, from]) =>
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
          const named = under?.label ?? materialLabel(name, material, owner.textures, role);
          return {
            name,
            label: settings?.label ?? named,
            labelBelow: named,
            from,
            origin: from === 'style' ? `From the ${b.style} style, set for ${b.id}` : undefined,
            origins: originsOf(layers.map((l, i) => [names[i]!, l?.[name]] as const)),
            values,
            enabledBelow: under?.enabled ?? MATERIAL_DEFAULTS.enabled,
            controls: materialControls(material, { pattern, drawAs: values.drawAs }),
            set: chosen?.[name],
            baseTint: under?.tint ?? NO_MATERIAL_TINT,
            // Its layers as worn here (a body's own masks on a style's material); any texture of
            // the body's, its style's or the sky's to read instead.
            layers: layersOf(
              withMasks(material, settings?.masks),
              settings,
              chosen?.[name],
              layers.map((l, i) => [names[i]!, l?.[name]] as const),
              { ...sky, ...b.styleFile?.textures, ...owner.textures, ...b.file?.textures },
            ),
          };
        })
      : [],
  );
  // In the order they are drawn (the tree's order): the level edited's, else what is under it.
  const order = b.settings.order ?? b.below?.order ?? b.styleBelow?.order;
  const priority = (name: string) =>
    (b.file?.materials[name] ?? b.styleFile?.materials[name])?.priority;
  return inDrawOrder(entries, order, priority);
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

/** A part's shape and how its textures lie on it, as in effect (its own where nothing is set). */
export interface PartValues {
  readonly size: number;
  readonly turn: number;
  readonly tilt: number;
  readonly width: number;
  readonly depth: number;
  readonly mid: number;
  readonly keepToLimb: boolean;
}

/** A body's part as its properties show it. */
export interface PartEntry {
  readonly key: PartKey;
  /** Its name: as renamed (the level edited's, else under it), else its role's (Surface, Shell, Ring…). */
  readonly label: string;
  /** Its name as the levels under the one edited have it. */
  readonly labelBelow: string;
  /** Whose it is: the body's own, or its style's (which one). */
  readonly from: 'own' | 'style';
  readonly style?: string;
  readonly kind: 'sphere' | 'ring';
  readonly values: PartValues;
  /** What of it is set in the layer edited. */
  readonly set: PartSettings | undefined;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof PartSettings>;
  /** A ring modelled to keep to its body's limb (it may be let go of it). */
  readonly canKeepToLimb: boolean;
  /** The materials drawn on it, by name. */
  readonly materials: readonly string[];
  /** Whether it is drawn (its materials with it), and whether it is under the level edited. */
  readonly enabled: boolean;
  readonly enabledBelow: boolean;
  /** Whether it comes with the overlay the body wears (else it is the body's own). */
  readonly overlay: boolean;
}

/** A part as the tree shows it: with the materials drawn on it, in the order they are drawn. */
export interface PartNode {
  readonly part: PartEntry;
  readonly materials: readonly MaterialEntry[];
}

/** A body's parts with their materials: its own, and those of the overlay it wears. */
export function partNodes(
  b: BodyInfo,
  materials: readonly MaterialEntry[],
): { own: PartNode[]; overlay: PartNode[] } {
  const nodes = partsOfBody(b).map((part) => ({
    part,
    materials: materials.filter((m) => part.materials.includes(m.name)),
  }));
  return {
    own: nodes.filter((n) => !n.part.overlay),
    overlay: nodes.filter((n) => n.part.overlay),
  };
}

/** Whether a body is drawn (a scene's; its moons with it). */
export const bodyEnabled = (b: BodyInfo) => b.settings.enabled ?? true;

/** Whether the overlay a body wears is drawn, as set and under the level edited. */
export const overlayEnabled = (b: BodyInfo) => b.settings.overlayEnabled ?? overlayEnabledBelow(b);
export const overlayEnabledBelow = (b: BodyInfo) => b.below?.overlayEnabled ?? true;

/** Each part's icon in the tree: a sphere, or a ring. */
export const partIcon = (p: PartEntry) => (p.kind === 'ring' ? 'radio_button_unchecked' : 'circle');

const PART_NAMES: Record<PartRole, string> = {
  surface: 'Surface',
  layer: 'Layer',
  shell: 'Shell',
  ring: 'Ring',
  shield: 'Shield',
};

/**
 * A body's parts as shown, its own then its style's as it wears them: each one's settings in
 * effect (those under the layer edited, then the layer edited's) over its own shape and mapping.
 */
export function partsOfBody(b: BodyInfo): PartEntry[] {
  // A style opened on its own: its parts are a style's (as kept for every planet wearing it).
  const owners: ['own' | 'style', readonly BodyPart[], boolean][] = [
    [b.file?.kind === 'style' ? 'style' : 'own', b.file?.parts ?? [], false],
    ['style', b.styleFile ? wornParts(b.file, b.style, b.styleFile.parts) : [], true],
  ];
  const levels: [string, PartSettingsMap | undefined][] = [
    ['the library (planet)', b.below?.parts],
    [`the library (${b.style})`, b.styleBelow?.parts],
  ];
  return owners.flatMap(([from, parts, overlay]) =>
    parts.map((part): PartEntry => {
      const key = partKey(from, part.role);
      const set = b.settings.parts?.[key];
      const settings = mergePartSettings(...levels.map(([, l]) => l), b.settings.parts)[key];
      const { shape, mapping } = part;
      const below = mergePartSettings(...levels.map(([, l]) => l))[key];
      const named = below?.label ?? PART_NAMES[part.role];
      return {
        key,
        label: settings?.label ?? named,
        labelBelow: named,
        from,
        style: from === 'style' ? b.style || b.id : undefined,
        kind: shape.kind,
        values: {
          size: settings?.size ?? 1,
          turn: settings?.turn ?? 0,
          tilt: settings?.tilt ?? 0,
          width: settings?.width ?? 1,
          depth: settings?.depth ?? (shape.kind === 'ring' ? shape.depth : 0),
          mid: settings?.mid ?? (mapping.kind === 'ring' ? (mapping.mid ?? 0.5) : 0.5),
          keepToLimb: settings?.keepToLimb ?? (shape.kind === 'ring' && shape.seen !== undefined),
        },
        set,
        origins: originsOf(levels.map(([name, l]) => [name, l?.[key]] as const)),
        canKeepToLimb: shape.kind === 'ring' && shape.seen !== undefined,
        materials: part.materials,
        enabled: settings?.enabled ?? true,
        enabledBelow: below?.enabled ?? true,
        overlay,
      };
    }),
  );
}

/** Each kind of light's icon in the tree. */
export const LIGHT_ICONS: Record<LightKind, string> = {
  ambient: 'brightness_low',
  directional: 'wb_sunny',
  shadow: 'contrast',
  reveal: 'visibility',
  activation: 'flare',
};

/** A body's light as its properties show it. */
export interface LightEntry {
  readonly light: BodyLight;
  /** Its name as the levels under the one edited have it (one added here: its own). */
  readonly nameBelow: string;
  /**
   * Whether it is on as the levels under the one edited have it (one added here: on), so switched
   * so here is nothing set.
   */
  readonly enabledBelow: boolean;
  /** What of it is set in the layer edited (the shadow's, as set before lights were objects too). */
  readonly set: LightSettings | undefined;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof LightSettings>;
  /** Whether it was added at the level edited (so it can be taken out there; its settings are its own). */
  readonly removable: boolean;
  /** Where it was added, where that is a level under the one edited (an overlay's, the library's). */
  readonly addedIn?: string;
  /** Whether it is the overlay's the body wears (shown under the overlay). */
  readonly overlay?: boolean;
  /** What of its body it may reach (none: a scene's, reaching every body), and what it reaches. */
  readonly receivers: readonly ReceiverEntry[];
  readonly reach?: LightReach;
  /** Whether it reaches its body's moons too, and whether it can (one added to a body). */
  readonly moons: boolean;
  readonly canReachMoons: boolean;
  /**
   * An activation light's tie to its body's reveal light (its grid's): whether it can be tied, and
   * the reveal's side it takes while it is.
   */
  readonly canTie?: boolean;
  readonly tiedFrom?: Vec3;
}

/** A part or material a body's light may reach, as its Reaches list shows it (a part, its materials under it). */
export interface ReceiverEntry {
  readonly receiver: Receiver;
  readonly label: string;
  readonly material: boolean;
}

/** What a body's lights may reach: its parts, each with the materials drawn on it (its overlay's named so). */
function receiversOf(b: BodyInfo): ReceiverEntry[] {
  const nodes = partNodes(b, materialsOf(b));
  return [...nodes.own, ...nodes.overlay].flatMap(({ part, materials }) => [
    {
      receiver: `part:${part.key}` as const,
      label: part.overlay ? `${part.label} (${styleLabel(b)})` : part.label,
      material: false,
    },
    ...materials.map((m) => ({
      receiver: `material:${m.name}` as const,
      label: m.label,
      material: true,
    })),
  ]);
}

/**
 * A body's lights as shown (see `bodyLights`): its rig as it is turned (Light from) with each
 * light's settings in effect over it, and its shadow as its shade comes to; what the layer edited
 * sets of each, and which level under it sets the rest.
 */
export function lightsOfBody(b: BodyInfo): LightEntry[] {
  const values = valuesOf(b);
  const rig = b.styleFile?.light ?? b.file?.light;
  // Its lights as they start: its rig as tuned (turned and made stronger together).
  const turned = rig && tunedRig(rig, values.lighting, values.lightFrom ?? undefined);
  const softness = {
    ...DEFAULT_SHADE,
    ...b.file?.tuning?.shade,
    ...b.styleFile?.shade,
    ...wearOf(b.file, b.style)?.shade,
  }.softness;
  const shade = { strength: values.shade, direction: values.shadeTowards, softness };
  const levels: [string, LightSettingsMap | undefined][] = [
    ['the library (planet)', b.below?.lights],
    [`the library (${b.style})`, b.styleBelow?.lights],
  ];
  const settings = mergeLightSettings(...levels.map(([, l]) => l), b.settings.lights);
  const under = mergeLightSettings(...levels.map(([, l]) => l));
  // A grid it has (its own, or its overlay's): its reveal and activation lights are the body's
  // (the overlay's, where the grid is the overlay's).
  const grid = materialsOf(b).find((m) => m.controls.colours);
  const lightsBelow = new Map(bodyLights(turned, shade, under, !!grid).map((l) => [l.id, l]));
  const body = bodyOrigins(b);
  // The lights added to it: under the level edited (the library's for the planet, its overlay's),
  // then the level edited's own (its settings are its own: nothing over them here).
  const below: [string, readonly AddedLight[] | undefined, boolean][] = [
    ['the library (planet)', b.below?.added, false],
    [b.style ? `the ${b.style} overlay` : 'the library', b.styleBelow?.added, true],
  ];
  const added: Omit<LightEntry, 'receivers' | 'moons' | 'canReachMoons'>[] = [
    ...below.flatMap(([name, list, overlay]) =>
      (list ?? []).map((l) => ({
        overlay,
        light: addedLight(l, settings[l.id]),
        nameBelow: addedLight(l, under[l.id]).name,
        enabledBelow: addedLight(l, under[l.id]).enabled,
        set: b.settings.lights?.[l.id],
        origins: originsOf(levels.map(([level, s]) => [level, s?.[l.id]] as const)),
        removable: false,
        addedIn: name,
      })),
    ),
    ...(b.settings.added ?? []).map((l) => ({
      light: addedLight(l),
      nameBelow: l.name,
      enabledBelow: true,
      set: undefined,
      origins: {},
      removable: true,
    })),
  ];
  // What each reaches (as set over an added light's own), and whether it reaches the moons.
  const receivers = receiversOf(b);
  const addedById = new Map(
    [...(b.below?.added ?? []), ...(b.styleBelow?.added ?? []), ...(b.settings.added ?? [])].map(
      (l) => [l.id, l] as const,
    ),
  );
  const entries = [...rigEntries(), ...added];
  const reveal = entries.find((e) => e.light.id === 'reveal')?.light.from;
  return entries.map((e) => {
    const own = addedById.get(e.light.id as `added-${string}`);
    const merged = { ...own, ...settings[e.light.id] };
    return {
      ...e,
      ...(e.light.kind === 'activation' && reveal ? { canTie: true, tiedFrom: reveal } : {}),
      ...(e.light.id === 'reveal' || e.light.id === 'activation'
        ? { overlay: grid?.from === 'style' }
        : {}),
      receivers,
      reach: merged.reach,
      moons: merged.moons ?? false,
      canReachMoons: own !== undefined,
    };
  });

  function rigEntries(): Omit<LightEntry, 'receivers' | 'moons' | 'canReachMoons'>[] {
    return bodyLights(turned, shade, settings, !!grid).map((light) => {
      const shadow = light.id === 'shadow';
      const own = b.settings.lights?.[light.id];
      const set = shadow ? { ...legacyShadow(b.settings), ...own } : own;
      const origins = originsOf(levels.map(([name, l]) => [name, l?.[light.id]] as const));
      return {
        light,
        nameBelow: lightsBelow.get(light.id)?.name ?? light.name,
        enabledBelow: lightsBelow.get(light.id)?.enabled ?? true,
        set: set && Object.keys(set).length ? set : undefined,
        origins: shadow ? { strength: body.shade, from: body.shadeTowards, ...origins } : origins,
        removable: false,
      };
    });
  }
}

/**
 * The lights added to a body (the library's, its overlay's, its own) that reach its moons, as set
 * (`lightsForMoons`).
 */
export function moonLightsOf(b: BodyInfo): AddedLight[] {
  return lightsForMoons(
    [...(b.below?.added ?? []), ...(b.styleBelow?.added ?? []), ...(b.settings.added ?? [])],
    mergeLightSettings(b.below?.lights, b.styleBelow?.lights, b.settings.lights),
  );
}

/** A scene's own lights as shown: each added to the scene (its settings its own). */
export function sceneLightsOf(lights: readonly AddedLight[] | undefined): LightEntry[] {
  return (lights ?? []).map((l) => ({
    light: addedLight(l),
    nameBelow: l.name,
    enabledBelow: true,
    set: undefined,
    origins: {},
    receivers: [],
    moons: false,
    canReachMoons: false,
    removable: true,
  }));
}

/**
 * A light from beyond a body that lights it too (its scene's, a planet's it is a moon of), where it
 * comes from, and whose it is (the scene, or the planet: its path, and whether its overlay's).
 */
export interface OuterLight {
  readonly light: AddedLight;
  readonly from: string;
  readonly owner: BodyPath | 'scene';
  readonly overlay?: boolean;
}

/** A light that may light what is selected (a body, a part, a material), as its Lit by list shows it. */
export interface LitByEntry {
  readonly id: LightId;
  readonly kind: LightKind;
  readonly name: string;
  /** Where it comes from, in words (a body's, its overlay's, the library's, the scene's). */
  readonly from: string;
  /** Whether it lights it (a body: whether it is on for it). */
  readonly reaches: boolean;
  /** Whether it is on as the levels under the one edited have it. */
  readonly enabledBelow: boolean;
  /** What of the body it reaches, as in effect and as under the level edited. */
  readonly reach?: LightReach;
  readonly reachBelow?: LightReach;
  /**
   * Whose it is, to find it in the tree: the body's own (none), the scene's, or a planet's it is a
   * moon of (its path); and whether it is the overlay's (shown under the overlay).
   */
  readonly owner?: BodyPath | 'scene';
  readonly overlay: boolean;
}

/** Whether a body's files are loaded (its overlay's too, where it wears one). */
export const filesLoaded = (b: BodyInfo) => !!b.file && (!b.style || !!b.styleFile);

/** A body's parts' materials, by part (its overlay's too). */
function partMaterialsOf(b: BodyInfo): PartMaterials {
  return new Map(partsOfBody(b).map((p) => [p.key as string, p.materials]));
}

/**
 * What lights a body (`receiver` none), one of its parts or one of its materials: each of its
 * lights (its own, its overlay's, the library's) and those from beyond it (`outer`) of a kind that
 * acts on what of it is selected (ambient, directional and shadow lights on a lit material; reveal
 * and activation lights on a grid). A body's list has each whether on or off for it; a part's or
 * material's, each on, and whether it reaches it.
 */
export function litByOf(
  b: BodyInfo,
  receiver: Receiver | null,
  outer: readonly OuterLight[] = [],
): LitByEntry[] {
  const materials = materialsOf(b);
  const parts = partMaterialsOf(b);
  const shown = materials.filter((m) =>
    receiver === null
      ? true
      : receiver.startsWith('part:')
        ? (parts.get(receiver.slice(5)) ?? []).includes(m.name)
        : receiver === `material:${m.name}`,
  );
  const acts = (kind: LightKind) =>
    shown.some((m) => (GRID_LIGHTS.includes(kind) ? !!m.controls.colours : m.values.lit));
  const under = mergeLightSettings(b.below?.lights, b.styleBelow?.lights);
  const addedBelow = new Map(
    [...(b.below?.added ?? []), ...(b.styleBelow?.added ?? [])].map((l) => [l.id, l] as const),
  );
  const own = bodyLabel(b);
  const lights = [
    ...lightsOfBody(b).map((e) => ({
      light: e.light,
      reach: e.reach,
      reachBelow: e.removable
        ? undefined
        : (under[e.light.id]?.reach ?? addedBelow.get(e.light.id as `added-${string}`)?.reach),
      enabledBelow: e.enabledBelow,
      from: e.addedIn ?? (e.overlay ? `the ${styleLabel(b)} overlay` : own),
      owner: undefined,
      overlay: !!e.overlay,
    })),
    ...outer.map(({ light, from, owner, overlay }) => {
      const set = b.settings.lights?.[light.id];
      return {
        light: addedLight(light, set),
        reach: set?.reach ?? light.reach,
        reachBelow: light.reach,
        enabledBelow: true,
        from,
        owner,
        overlay: !!overlay,
      };
    }),
  ];
  return lights
    .filter(({ light }) => acts(light.kind) && (receiver === null || light.enabled))
    .map(({ light, ...l }) => ({
      id: light.id,
      kind: light.kind,
      name: light.name,
      from: l.from,
      reaches: receiver === null ? light.enabled : reachesReceiver(l.reach, receiver, parts),
      enabledBelow: l.enabledBelow,
      ...(l.reach ? { reach: l.reach } : {}),
      ...(l.reachBelow ? { reachBelow: l.reachBelow } : {}),
      ...(l.owner !== undefined ? { owner: l.owner } : {}),
      overlay: l.overlay,
    }));
}

/**
 * A body's settings at the level edited with a light taken in or left out by what is selected: a
 * body, switched on or off for it; a part or material, in or out of what it reaches (the reach
 * set here, unless it comes to what is under this level; a light added here, its own).
 */
export function withLitBy(
  s: BodySettings,
  b: BodyInfo,
  light: LitByEntry,
  receiver: Receiver | null,
  on: boolean,
): BodySettings | undefined {
  const id = light.id;
  if (receiver === null) return withLightSwitched(s, id, on, light.enabledBelow);
  const reach = withReceiver(light.reach, receiver, on, partMaterialsOf(b));
  if (s.added?.some((l) => l.id === id))
    return {
      ...s,
      added: s.added.map((l) =>
        l.id !== id ? l : reach ? { ...l, reach } : (without(l, ['reach']) ?? l),
      ),
    };
  if (sameReach(reach, light.reachBelow)) return withoutLightSetting(s, id, ['reach']);
  // Reaching everything over a reach under it: said so.
  return withLightSetting(s, id, { reach: reach ?? { mode: 'except', receivers: [] } });
}

const sameReach = (a: LightReach | undefined, b: LightReach | undefined) => {
  const key = (r: LightReach | undefined) =>
    r && (r.mode === 'only' || r.receivers.length)
      ? `${r.mode}:${[...r.receivers].sort().join(',')}`
      : 'all';
  return key(a) === key(b);
};

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
    changed: Object.keys(b.settings).length > 0,
    baseTint: b.below?.tint ?? b.file?.tuning?.tint ?? NO_MATERIAL_TINT,
    focused,
    canHaveMoons,
    origins: {
      ...bodyOrigins(b),
      label: b.below?.label !== undefined ? 'the library (planet)' : undefined,
    },
    label: bodyLabel(b),
    labelBelow: bodyLabelBelow(b),
  };
}

/** A body's name as shown: as renamed (the level edited's, else the library's), else its id. */
export const bodyLabel = (b: BodyInfo) => b.settings.label ?? bodyLabelBelow(b);
export const bodyLabelBelow = (b: BodyInfo) => b.below?.label ?? b.id;
/** The name of the overlay a body wears: as renamed in the library, else its style's id. */
export const styleLabel = (b: BodyInfo) => b.styleBelow?.label ?? b.style;
/** A body's name with the overlay it wears. */
export const wornLabel = (b: BodyInfo) =>
  b.style ? `${bodyLabel(b)} · ${styleLabel(b)}` : bodyLabel(b);

/** The sky's materials as shown: the scene file's, through what is under the layer edited and the layer edited. */
export function skyMaterialsOf(
  scene: PlayScene,
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
    const named = under?.label ?? materialLabel(name, material, scene.textures);
    out.push({
      name,
      label: edited?.materials?.[name]?.label ?? named,
      labelBelow: named,
      from: 'own',
      origins: originsOf([
        ['the library (material)', base?.[name]],
        ['the library (sky)', below?.materials?.[name]],
      ]),
      values: materialValues(
        material,
        mergeMaterialSettings(base, below?.materials, edited?.materials)[name],
        skyDepths(scene)[name],
      ),
      enabledBelow: under?.enabled ?? MATERIAL_DEFAULTS.enabled,
      controls: materialControls(material, { particles: drawn, sky: true }),
      set: edited?.materials?.[name],
      baseTint: under?.tint ?? NO_MATERIAL_TINT,
      layers: layersOf(
        material,
        mergeMaterialSettings(base, below?.materials, edited?.materials)[name],
        edited?.materials?.[name],
        [
          ['the library (material)', base?.[name]],
          ['the library (sky)', below?.materials?.[name]],
        ],
        scene.textures,
      ),
    });
  }
  return inDrawOrder(out, edited?.order ?? below?.order, (n) => scene.materials[n]?.priority);
}

/** Materials as shown, in the order they are drawn (see `drawOrder`). */
function inDrawOrder(
  entries: readonly MaterialEntry[],
  order: readonly string[] | undefined,
  priority: (name: string) => number | undefined,
): MaterialEntry[] {
  const names = drawOrder(
    entries.map((m) => ({ name: m.name, blend: m.values.blend, priority: priority(m.name) })),
    order,
  );
  return [...entries].sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
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
  skyDepth?: MaterialDepth,
): MaterialEntry {
  const values = materialValues(material, mergeMaterialSettings(tuning, base)[name], skyDepth);
  const sky = skyDepth !== undefined;
  const named = tuning?.[name]?.label ?? materialLabel(name, material, textures, role);
  return {
    name,
    label: base?.[name]?.label ?? named,
    labelBelow: named,
    from: 'own',
    origins: originsOf([['its tuning', tuning?.[name]]]),
    values,
    enabledBelow: tuning?.[name]?.enabled ?? MATERIAL_DEFAULTS.enabled,
    controls: materialControls(material, { pattern, particles, drawAs: values.drawAs, sky }),
    set: base?.[name],
    baseTint: tuning?.[name]?.tint ?? NO_MATERIAL_TINT,
    layers: layersOf(
      material,
      mergeMaterialSettings(tuning, base)[name],
      base?.[name],
      [['its tuning', tuning?.[name]]],
      textures,
    ),
  };
}

/** A sky's materials' groups in its tree, by where each is drawn among the scene's objects. */
export const DEPTH_GROUPS: readonly {
  readonly depth: MaterialDepth;
  readonly label: string;
  readonly icon: string;
}[] = [
  { depth: 'background', label: 'Background', icon: 'flip_to_back' },
  { depth: 'scene', label: 'Midground', icon: 'vertical_align_center' },
  { depth: 'foreground', label: 'Foreground', icon: 'flip_to_front' },
];

/** A sky's materials by their depth as set (else as the data puts them), in its groups' order; empty groups left out. */
export function byDepth(materials: readonly MaterialEntry[]): {
  readonly depth: MaterialDepth;
  readonly label: string;
  readonly icon: string;
  readonly materials: MaterialEntry[];
}[] {
  return DEPTH_GROUPS.map((g) => ({
    ...g,
    materials: materials.filter((m) => m.values.depth === g.depth),
  })).filter((g) => g.materials.length);
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
