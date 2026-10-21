import { bodyFrame } from '../../../scenes/play-background/scene-renderer';
import type { SetPlanet } from '../../../scenes/play-background/planet-sets';
import {
  MATERIAL_DEFAULTS,
  type MaterialControls,
  materialControls,
  type MaterialValues,
  materialValues,
  materialKey,
  mergeMaterialSettings,
  mergeSettings,
  NO_MATERIAL_TINT,
  originsOf,
  type SettingOrigins,
} from '../../../scenes/play-background/material-settings';
import {
  PLAY_SCENE_URL,
  type PlayScene,
  type SceneMaterial,
  type SceneTexture,
  type SkyOverlayFile,
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
  DEFAULT_ORBIT,
} from '../../../scenes/play-background/background-scene';
import { keyLightFrom, TOWARDS_EYE } from '../../../scenes/play-background/scene-directions';
import {
  alongToSphere,
  coneEdges,
  type LightAid,
  type LightOutline,
} from '../../../scenes/play-background/scene-beams';
import { LIGHT_KINDS } from '../../../scenes/play-background/draw-uniforms';
import { aimOf, type LookAt } from '../../../scenes/play-background/look-at';
import {
  addedLight,
  bodyLights,
  knownLights,
  lightsForMoons,
  mergeLightSettings,
  placedLight,
  reachesReceiver,
  rgbOf,
  tunedRig,
  type AddedLight,
  type BodyLight,
  type LightId,
  type LightKind,
  type LightReach,
  type LightSettings,
  type LightSettingsMap,
  type NewLightKind,
  type PartMaterials,
  type Receiver,
  withReceiver,
} from '../../../scenes/play-background/scene-lights';
import {
  HALO_MARGIN,
  legacyShadow,
  withLightSetting,
  withLightSwitched,
  withoutLightSetting,
} from '../../../scenes/play-background/scene-bodies';
import { materialLabel, textureLabel } from '../../../scenes/play-background/material-names';
import { overlayOn, wornKey } from '../../../scenes/play-background/overlays';
import type { LibraryState } from '../../../scenes/play-background/background-design';
import {
  createdSkyFile,
  type SourceLookup,
  overlayName,
} from '../../../scenes/play-background/created-overlays';
import type { PlanetIndex } from '../../../scenes/play-background/scene-planets';
import type { PickChoice } from './pick-list';
import { REFERENCE_KEY } from './editing-aids.store';
import type { TreeRow } from './scene-tree';
import {
  DEFAULT_SHADE,
  drawOrder,
  reordered,
  layerSlots,
  type LayerSettings,
  type LayerSlot,
  type GridLight,
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
  ownPartKey,
  overlayPartKey,
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
  /** A group put in a scene. */
  | 'placement'
  /** A scene's cameras (their group), and one of them. */
  | 'cameras'
  | 'camera'
  | 'part'
  | 'light'
  /** What of a material a row shows: one of its layers, its shield shader, one of that's lights. */
  | 'layer'
  | 'shader'
  | 'gridLight';

/**
 * An overlay a body wears, as an editor has it: which, its settings under the layer edited (the
 * library's: the overlay's own, as it is wherever it is worn), its file once loaded.
 */
export interface WornOverlay {
  readonly id: string;
  /** Its name as made, where it was made in the editor (else its id is its name). */
  readonly name?: string;
  readonly below?: BodySettings;
  readonly file?: PlanetFile;
}

/**
 * A body as an editor has it: which planet (or overlay), the overlays it wears, its settings in
 * the layer edited and those under it, its files once loaded.
 */
export interface BodyInfo {
  /** How the editor names it (its row's key). */
  readonly key: string;
  readonly id: string;
  /** Its name as made, where it is an overlay made in the editor (else its id is its name). */
  readonly name?: string;
  /** The overlays it wears, the later over the earlier. */
  readonly overlays: readonly WornOverlay[];
  /** Whether what it wears is chosen in the layer edited (else what is under it). */
  readonly overlaysSet: boolean;
  /** Its settings in the layer edited. */
  readonly settings: BodySettings;
  /** Its own defaults, under the layer edited (the library's, under a scene). */
  readonly below?: BodySettings;
  /** The materials' base settings (the library's), under its own. */
  readonly materialBase?: MaterialSettingsMap;
  readonly file?: PlanetFile;
  /** Its orbit, where it is a moon in a scene. */
  readonly orbit?: Orbit;
  /** Where it is and how big, where it is one of a scene's planets. */
  readonly place?: { readonly position: Vec3; readonly radius: number };
  readonly moons: readonly MoonChoices[];
  /** One of its planet's own moons (the library's): as the planet has it, under what the scene sets. */
  readonly inherited?: MoonChoices;
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
  /** Whether moons can be put about it (a scene's bodies, but for its planets' own moons). */
  readonly canHaveMoons: boolean;
  /** Whether it is one of its planet's own moons (switched off in a scene, never taken out). */
  readonly inherited: boolean;
  /** Its orbit under the level edited: its planet's for its own moon, else a new moon's. */
  readonly orbitBase: Orbit;
  /** Whether its lights are set here (a library planet's own moon's are its own planet's: not here). */
  readonly lights: boolean;
  /** Whether the overlays it wears are chosen here (a scene's bodies, a library planet's own moons). */
  readonly styled: boolean;
  /** Whether the view can be centred on it (a scene's moons). */
  readonly focusable: boolean;
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
  /** Its name in the game data (what its base settings are kept by). */
  readonly name: string;
  /** What its settings are kept by (an overlay's: by the overlay too; see `materialKey`). */
  readonly key: string;
  /** Its priority in the data (where it is drawn, its draw order not set). */
  readonly priority?: number;
  /** Its name as shown: as renamed (the level edited's, else under it), else `materialLabel`. */
  readonly label: string;
  /** Its name as the levels under the one edited have it (what clearing a rename here gives). */
  readonly labelBelow: string;
  /** Whose it is: the body's own, or an overlay's it wears (`overlay`: which). */
  readonly from: 'own' | 'style';
  readonly overlay?: string;
  /** Where it comes from, in words, where it isn't the body's own (an overlay's: which, and for whom). */
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
  /** Whether it is drawn by a part added onto its owner (a sky's: listed with that part). */
  readonly added?: boolean;
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

/**
 * A material of a planet's (or overlay's) parts: whether a pattern is drawn for it, and its part's
 * role, where it says what the material is (not a part made in the editor's: it draws any).
 */
export interface PartMaterial {
  readonly name: string;
  readonly material: SceneMaterial;
  readonly pattern: boolean;
  readonly role?: PartRole;
}

/** A planet's (or style's) materials, in its parts' order, each once (with its first part's role). */
export function partMaterials(file: PlanetFile): PartMaterial[] {
  const out: PartMaterial[] = [];
  for (const part of file.parts)
    for (const name of part.materials) {
      const material = file.materials[name];
      if (material && !out.some((m) => m.name === name))
        out.push({
          name,
          material,
          pattern: part.pattern !== undefined,
          ...(part.id ? {} : { role: part.role }),
        });
    }
  return out;
}

/** The material a row names, by what its settings are kept by (two may share a name: see `materialKey`). */
export const materialAt = (list: readonly MaterialEntry[], key: string) =>
  list.find((m) => m.key === key);

/** The ids of the overlays a body wears. */
export const wornIds = (b: BodyInfo) => b.overlays.map((o) => o.id);
/** The key a body's settings are kept by for what it wears (see `wornKey`). */
export const wornKeyOf = (b: BodyInfo) => wornKey(wornIds(b));
/** An overlay's name: as renamed in the library, else its id. */
export const overlayLabel = (o: WornOverlay) => o.below?.label ?? o.name ?? o.id;
/** The last of some values that is set (the later over the earlier). */
const latest = <T>(values: readonly (T | undefined)[]): T | undefined =>
  values.filter((v) => v !== undefined).at(-1);

/**
 * A body's materials, its own then each overlay's, as shown: each through its file's tuning (and
 * how the body wears its overlays), the defaults under the layer edited, and the layer edited.
 */
export function materialsOf(
  b: BodyInfo,
  sky: Readonly<Record<string, SceneTexture>> = {},
): MaterialEntry[] {
  const chosen = b.settings.materials;
  // An overlay opened on its own: its materials are an overlay's (as kept for all wearing it).
  const opened = b.file?.kind === 'style' ? b.id : undefined;
  const owners: [PlanetFile | undefined, WornOverlay | undefined][] = [
    [b.file, undefined],
    ...b.overlays.map((o): [PlanetFile | undefined, WornOverlay] => [o.file, o]),
  ];
  const textures = Object.assign({}, ...b.overlays.map((o) => o.file?.textures)) as Readonly<
    Record<string, SceneTexture>
  >;
  const entries = owners.flatMap(([owner, overlay]) =>
    owner
      ? partMaterials(owner).map(({ name, material, pattern, role }) => {
          const from = overlay ? ('style' as const) : ('own' as const);
          const key = materialKey(name, overlay?.id ?? opened);
          // Its levels under the one edited: an overlay's through its tuning, how the body
          // wears it, its base settings, the overlay's own and the body's for it.
          const levels: (readonly [string, MaterialSettings | undefined])[] = overlay
            ? [
                [`the ${overlayLabel(overlay)} overlay`, owner.tuning?.materials?.[name]],
                [
                  `${b.id}'s tuning for ${overlayLabel(overlay)}`,
                  wearOf(b.file, overlay.id)?.materials?.[name],
                ],
                ['the library (material)', b.materialBase?.[name]],
                [`the library (${overlayLabel(overlay)})`, overlay.below?.materials?.[key]],
                ['the library (planet)', b.below?.materials?.[key]],
              ]
            : [
                ['its tuning', owner.tuning?.materials?.[name]],
                ['the library (material)', b.materialBase?.[name]],
                ['the library (planet)', b.below?.materials?.[key]],
              ];
          const under = mergeSettings(...levels.map(([, l]) => l));
          const settings = mergeSettings(under, chosen?.[key]);
          const values = materialValues(material, settings);
          const named = under?.label ?? materialLabel(name, material, owner.textures, role);
          return {
            name,
            key,
            ...(material.priority !== undefined ? { priority: material.priority } : {}),
            label: settings?.label ?? named,
            labelBelow: named,
            from,
            ...(overlay ? { overlay: overlay.id } : {}),
            origin: overlay
              ? `From the ${overlayLabel(overlay)} overlay, set for ${b.id}`
              : undefined,
            origins: originsOf(levels),
            values,
            enabledBelow: under?.enabled ?? MATERIAL_DEFAULTS.enabled,
            controls: materialControls(material, { pattern, drawAs: values.drawAs }),
            set: chosen?.[key],
            baseTint: under?.tint ?? NO_MATERIAL_TINT,
            // Its layers as worn here (a body's own masks on an overlay's material); any texture
            // of the body's, its overlays' or the sky's to read instead.
            layers: layersOf(
              withMasks(material, settings?.masks),
              settings,
              chosen?.[key],
              levels,
              { ...sky, ...textures, ...owner.textures, ...b.file?.textures },
            ),
          };
        })
      : [],
  );
  // In the order they are drawn (the tree's order): the level edited's, else what is under it.
  const orders = b.overlays.flatMap((o) => (o.below?.order ? [o.below.order] : []));
  const order = b.settings.order ?? b.below?.order ?? (orders.length ? orders.flat() : undefined);
  return inDrawOrder(entries, order);
}

/**
 * A body's materials' draw order (by key) with one moved to just before (or after) another drawn
 * on the same part (a material isn't moved to another part: none).
 */
export function movedInPart(
  b: BodyInfo,
  all: readonly MaterialEntry[],
  from: string,
  to: string,
  after: boolean,
): string[] | undefined {
  const { own, overlays } = partNodes(b, all);
  const node = [...own, ...overlays.flatMap((o) => o.nodes)].find((n) =>
    n.materials.some((m) => m.key === to),
  );
  const group = node?.materials.map((m) => m.key);
  if (!group?.includes(from)) return undefined;
  return reordered(
    all.map((m) => m.key),
    group,
    from,
    to,
    after,
  );
}

/** The light a body is lit by: its overlays' (the first of them that has one), else its own. */
export const rigOf = (b: BodyInfo) =>
  b.overlays.find((o) => o.file?.light)?.file?.light ?? b.file?.light;

/** How a body's overlays shade it, each setting the later's over the earlier's. */
function overlayShades(b: BodyInfo) {
  const wear = (o: WornOverlay) => wearOf(b.file, o.id)?.shade;
  return {
    strength: {
      styled: latest(b.overlays.map((o) => o.below?.shade)),
      wear: latest(b.overlays.map((o) => wear(o)?.strength)),
      style: latest(b.overlays.map((o) => o.file?.shade?.strength)),
    },
    direction: {
      styled: latest(b.overlays.map((o) => o.below?.shadeTowards)),
      wear: latest(b.overlays.map((o) => wear(o)?.direction)),
      style: latest(b.overlays.map((o) => o.file?.shade?.direction)),
    },
  };
}

/** A body's own settings as shown: the layer edited, over those under it (its overlays' shade over its own), over its files' tuning, over the defaults. */
export function valuesOf(b: BodyInfo): BodyValues {
  const tuning = b.file?.tuning;
  const s = b.settings;
  const own = b.below;
  const { strength, direction } = overlayShades(b);
  return {
    overlays: wornIds(b),
    lighting: s.lighting ?? own?.lighting ?? tuning?.lighting ?? 1,
    // An overlay it wears shades it its way (as it wears it); else its own.
    shade:
      s.shade ??
      strength.styled ??
      own?.shade ??
      strength.wear ??
      strength.style ??
      tuning?.shade?.strength ??
      DEFAULT_SHADE.strength,
    tint: s.tint ?? own?.tint ?? tuning?.tint ?? NO_MATERIAL_TINT,
    lightFrom: s.lightFrom ?? own?.lightFrom ?? tuning?.lightFrom ?? keyLightFrom(rigOf(b)),
    shadeTowards:
      s.shadeTowards ??
      direction.styled ??
      own?.shadeTowards ??
      direction.wear ??
      direction.style ??
      tuning?.shade?.direction ??
      DEFAULT_SHADE.direction,
    rim: s.rim ?? own?.rim ?? tuning?.rim ?? TOWARDS_EYE,
    glowMargin: s.glowMargin ?? own?.glowMargin ?? HALO_MARGIN,
  };
}

/** A part's shape and how its textures lie on it, as in effect (its own where nothing is set). */
export interface PartValues {
  readonly size: number;
  readonly turn: number;
  readonly tilt: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly mid: number;
  readonly keepToLimb: boolean;
  readonly flip: boolean;
  /** A tube's or a cone's side: its outside, or its inside. */
  readonly side: 'near' | 'far';
  readonly from: number;
  readonly repeat: number;
}

/** A body's part as its properties show it. */
export interface PartEntry {
  readonly key: PartKey;
  /** Its name: as renamed (the level edited's, else under it), else its role's (Surface, Shell, Ring…). */
  readonly label: string;
  /** Its name as the levels under the one edited have it. */
  readonly labelBelow: string;
  /** Whose it is: the body's own, or an overlay's (an overlay opened on its own: its own, kept as an overlay's). */
  readonly from: 'own' | 'style';
  /** Its shape: a body's sphere, ring, tube, cone or disc, or a sky overlay's part about the eye. */
  readonly kind: 'sphere' | 'ring' | 'tube' | 'cone' | 'disc' | 'capsule' | 'plane' | 'sky';
  /** Whether it is a band (a sky overlay's part made in the editor: it has a width). */
  readonly band?: boolean;
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
  /** The overlay the body wears it comes with, by id (none: the body's own). */
  readonly overlay?: string;
  /** That overlay's name, where it is one worn (not the overlay open itself). */
  readonly overlayName?: string;
  /** Whether it was added onto its owner at the level edited (it can be taken off, its materials picked). */
  readonly added?: boolean;
}

/** A part as the tree shows it: with the materials drawn on it, in the order they are drawn. */
export interface PartNode {
  readonly part: PartEntry;
  readonly materials: readonly MaterialEntry[];
}

/** A body's parts with their materials: its own, and each overlay's it wears. */
export function partNodes(
  b: BodyInfo,
  materials: readonly MaterialEntry[],
): { own: PartNode[]; overlays: { overlay: WornOverlay; nodes: PartNode[] }[] } {
  const nodes = partsOfBody(b).map((part) => ({
    part,
    materials: materials.filter(
      (m) => part.materials.includes(m.name) && (m.overlay ?? null) === (part.overlay ?? null),
    ),
  }));
  return {
    own: nodes.filter((n) => !n.part.overlay),
    overlays: b.overlays.map((overlay) => ({
      overlay,
      nodes: nodes.filter((n) => n.part.overlay === overlay.id),
    })),
  };
}

/** Whether a body is drawn (a scene's; its moons with it). */
/** Whether a body is drawn: as set at the level edited, else under it (a planet's own moon may be off there). */
export const bodyEnabled = (b: BodyInfo) => b.settings.enabled ?? b.below?.enabled ?? true;

/** Whether an overlay a body wears is drawn, as set and under the level edited. */
export const overlayEnabled = (b: BodyInfo, id: string) =>
  overlayOn(id, b.settings) ?? overlayEnabledBelow(b, id);
export const overlayEnabledBelow = (b: BodyInfo, id: string) => overlayOn(id, b.below) ?? true;

/** Each part's icon in the tree: a sphere, or a ring. */
export const partIcon = (p: PartEntry) => PART_ICONS[p.kind];

/** Each shape's icon in the tree (and where parts are added). */
export const PART_ICONS: Record<PartEntry['kind'], string> = {
  sphere: 'circle',
  ring: 'radio_button_unchecked',
  tube: 'crop_portrait',
  cone: 'change_history',
  disc: 'album',
  capsule: 'pill',
  plane: 'rectangle',
  sky: 'panorama_horizontal',
};

const PART_NAMES: Record<PartRole, string> = {
  surface: 'Surface',
  layer: 'Layer',
  shell: 'Shell',
  ring: 'Ring',
  shield: 'Shield',
  sphere: 'Sphere',
  band: 'Band',
  tube: 'Tube',
  cone: 'Cone',
  disc: 'Disc',
  capsule: 'Capsule',
  plane: 'Plane',
};

/** A part of the game data's name: its role's (Surface, Shell, Ring…). */
export const partName = (part: { readonly role: PartRole }) => PART_NAMES[part.role];

/** A part's name made from its id, where it has one (an overlay's made in the editor: `ring-2`, Ring 2). */
const idLabel = (id: string) => {
  const [shape, n] = id.split('-');
  return `${(shape ?? id).charAt(0).toUpperCase()}${(shape ?? id).slice(1)}${n ? ` ${n}` : ''}`;
};

/**
 * A body's parts as shown, its own then each overlay's as it wears them: each one's settings in
 * effect (those under the layer edited, then the layer edited's) over its own shape and mapping.
 */
export function partsOfBody(b: BodyInfo): PartEntry[] {
  const overlayNamed = (id: string) => {
    const o = b.overlays.find((x) => x.id === id);
    return o ? overlayLabel(o) : id;
  };
  // An overlay opened on its own: its parts are an overlay's (as kept for every planet wearing it).
  const opened = b.file?.kind === 'style';
  const owners: [readonly BodyPart[], string | undefined][] = [
    [b.file?.parts ?? [], undefined],
    ...b.overlays.map((o): [readonly BodyPart[], string] => [
      o.file ? wornParts(b.file, o.id, o.file.parts) : [],
      o.id,
    ]),
  ];
  const levels: [string, PartSettingsMap | undefined][] = [
    ['the library (planet)', b.below?.parts],
    ...b.overlays.map((o): [string, PartSettingsMap | undefined] => [
      `the library (${overlayLabel(o)})`,
      o.below?.parts,
    ]),
  ];
  return owners.flatMap(([parts, overlay]) =>
    parts.map((part): PartEntry => {
      const from = overlay || opened ? 'style' : 'own';
      const key = overlay
        ? overlayPartKey(overlay, part)
        : opened
          ? overlayPartKey(b.id, part)
          : ownPartKey(part);
      const set = b.settings.parts?.[key];
      const settings = mergePartSettings(...levels.map(([, l]) => l), b.settings.parts)[key];
      const { shape, mapping } = part;
      const below = mergePartSettings(...levels.map(([, l]) => l))[key];
      const named = below?.label ?? (part.id ? idLabel(part.id) : PART_NAMES[part.role]);
      return {
        key,
        label: settings?.label ?? named,
        labelBelow: named,
        from,
        kind: shape.kind,
        values: {
          size: settings?.size ?? 1,
          turn: settings?.turn ?? 0,
          tilt: settings?.tilt ?? 0,
          width: settings?.width ?? 1,
          height: settings?.height ?? 1,
          depth: settings?.depth ?? (shape.kind === 'ring' ? shape.depth : 0),
          mid: settings?.mid ?? (mapping.kind === 'ring' ? (mapping.mid ?? 0.5) : 0.5),
          keepToLimb: settings?.keepToLimb ?? (shape.kind === 'ring' && shape.seen !== undefined),
          flip:
            settings?.flip ??
            ((mapping.kind === 'sphere' || mapping.kind === 'round') && mapping.flip),
          side: settings?.side ?? ('side' in shape ? shape.side : 'near'),
          from:
            settings?.from ??
            (mapping.kind === 'ring' ? Math.round(((mapping.from * 180) / Math.PI) * 10) / 10 : 0),
          repeat:
            settings?.repeat ??
            (mapping.kind === 'ring'
              ? mapping.uMax
              : mapping.kind === 'round'
                ? mapping.repeat
                : 1),
        },
        set,
        origins: originsOf(levels.map(([name, l]) => [name, l?.[key]] as const)),
        canKeepToLimb: shape.kind === 'ring' && shape.seen !== undefined,
        materials: part.materials,
        enabled: settings?.enabled ?? true,
        enabledBelow: below?.enabled ?? true,
        ...(overlay ? { overlay, overlayName: overlayNamed(overlay) } : {}),
        ...(!overlay && part.id && b.settings.addedParts?.some((a) => a.id === part.id)
          ? { added: true }
          : {}),
      };
    }),
  );
}

/** Each kind of light's icon (an antilight's: any light that darkens). */
export const LIGHT_ICONS: Record<NewLightKind, string> = {
  ambient: 'brightness_low',
  directional: 'wb_sunny',
  antilight: 'contrast',
  point: 'flare',
  spot: 'highlight',
  hemisphere: 'wb_twilight',
  environment: 'lens_blur',
};

/** A light's icon in the tree: by its kind, or an antilight's where it darkens. */
export const lightIcon = (l: { readonly kind: LightKind; readonly darkens?: boolean }): string =>
  l.darkens ? LIGHT_ICONS.antilight : LIGHT_ICONS[l.kind];

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
  /** The overlay the body wears it is of, by id (shown under the overlay); none: the body's. */
  readonly overlay?: string;
  /** What of its body it may reach (none: a scene's, reaching every body), and what it reaches. */
  readonly receivers: readonly ReceiverEntry[];
  readonly reach?: LightReach;
  /** Whether it reaches its body's moons too, and whether it can (one added to a body). */
  readonly moons: boolean;
  readonly canReachMoons: boolean;
}

/** A part or material a body's light may reach, as its Reaches list shows it (a part, its materials under it). */
export interface ReceiverEntry {
  readonly receiver: Receiver;
  readonly label: string;
  readonly material: boolean;
}

/** What a body's lights may reach: its parts, each with the materials drawn on it (its overlays' named so). */
function receiversOf(b: BodyInfo): ReceiverEntry[] {
  const nodes = partNodes(b, materialsOf(b));
  const named = (id: string | undefined) => {
    const o = b.overlays.find((x) => x.id === id);
    return o ? ` (${overlayLabel(o)})` : '';
  };
  return [...nodes.own, ...nodes.overlays.flatMap((o) => o.nodes)].flatMap(
    ({ part, materials }) => [
      {
        receiver: `part:${part.key}` as const,
        label: part.label + named(part.overlay),
        material: false,
      },
      ...materials.map((m) => ({
        receiver: `material:${m.key}` as const,
        label: m.label,
        material: true,
      })),
    ],
  );
}

/**
 * A body's lights as shown (see `bodyLights`): its rig as it is turned (Light from) with each
 * light's settings in effect over it, and its shadow as its shade comes to; what the layer edited
 * sets of each, and which level under it sets the rest.
 */
export function lightsOfBody(b: BodyInfo): LightEntry[] {
  const values = valuesOf(b);
  const rig = rigOf(b);
  // Its lights as they start: its rig as tuned (turned and made stronger together).
  const turned = rig && tunedRig(rig, values.lighting, values.lightFrom ?? undefined);
  const softness = b.overlays.reduce(
    (a, o) => ({ ...a, ...o.file?.shade, ...wearOf(b.file, o.id)?.shade }),
    { ...DEFAULT_SHADE, ...b.file?.tuning?.shade },
  ).softness;
  const shade = { strength: values.shade, direction: values.shadeTowards, softness };
  const levels: [string, LightSettingsMap | undefined][] = [
    ['the library (planet)', b.below?.lights],
    ...b.overlays.map((o): [string, LightSettingsMap | undefined] => [
      `the library (${overlayLabel(o)})`,
      o.below?.lights,
    ]),
  ];
  const settings = mergeLightSettings(...levels.map(([, l]) => l), b.settings.lights);
  const under = mergeLightSettings(...levels.map(([, l]) => l));
  const lightsBelow = new Map(bodyLights(turned, shade, under).map((l) => [l.id, l]));
  const body = bodyOrigins(b);
  // The lights added to it: under the level edited (the library's for the planet, its overlay's),
  // then the level edited's own (its settings are its own: nothing over them here).
  const below: [string, readonly AddedLight[] | undefined, string | undefined][] = [
    ['the library (planet)', b.below?.added, undefined],
    ...b.overlays.map((o): [string, readonly AddedLight[] | undefined, string] => [
      `the ${overlayLabel(o)} overlay`,
      o.below?.added,
      o.id,
    ]),
  ];
  const added: Omit<LightEntry, 'receivers' | 'moons' | 'canReachMoons'>[] = [
    ...below.flatMap(([name, list, overlay]) =>
      knownLights(list ?? []).map((l) => ({
        ...(overlay ? { overlay } : {}),
        light: addedLight(l, settings[l.id]),
        nameBelow: addedLight(l, under[l.id]).name,
        enabledBelow: addedLight(l, under[l.id]).enabled,
        set: b.settings.lights?.[l.id],
        origins: originsOf(levels.map(([level, s]) => [level, s?.[l.id]] as const)),
        removable: false,
        addedIn: name,
      })),
    ),
    ...knownLights(b.settings.added ?? []).map((l) => ({
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
    [...addedBelowOf(b), ...(b.settings.added ?? [])].map((l) => [l.id, l] as const),
  );
  return [...rigEntries(), ...added].map((e) => {
    const own = addedById.get(e.light.id as `added-${string}`);
    const merged = { ...own, ...settings[e.light.id] };
    return {
      ...e,
      receivers,
      reach: merged.reach,
      moons: merged.moons ?? false,
      canReachMoons: own !== undefined,
    };
  });

  function rigEntries(): Omit<LightEntry, 'receivers' | 'moons' | 'canReachMoons'>[] {
    return bodyLights(turned, shade, settings).map((light) => {
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
    [...addedBelowOf(b), ...(b.settings.added ?? [])],
    mergeLightSettings(lightsBelowOf(b), b.settings.lights),
  );
}

/** The lights added to a body under the level edited: the library's for it, then its overlays'. */
const addedBelowOf = (b: BodyInfo): AddedLight[] => [
  ...(b.below?.added ?? []),
  ...b.overlays.flatMap((o) => o.below?.added ?? []),
];
/** What is set for a body's lights under the level edited: the library's for it, then its overlays'. */
const lightsBelowOf = (b: BodyInfo) =>
  mergeLightSettings(b.below?.lights, ...b.overlays.map((o) => o.below?.lights));

/** A scene's own lights as shown: each added to the scene (its settings its own). */
export function sceneLightsOf(lights: readonly AddedLight[] | undefined): LightEntry[] {
  return knownLights(lights ?? []).map((l) => ({
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
 * A light from beyond a body that lights it too (its scene's, a planet's it is a moon of), and
 * whose it is (the scene, or the planet: its path, and whether its overlay's).
 */
export interface OuterLight {
  readonly light: AddedLight;
  readonly owner: BodyPath | 'scene';
  /** The overlay of the planet it is of, by id, where it is an overlay's. */
  readonly overlay?: string;
}

/** A light that may light what is selected (a body, a part, a material), as its Lit by list shows it. */
export interface LitByEntry {
  readonly id: LightId;
  readonly kind: LightKind;
  readonly name: string;
  /** Whether it lights it (a body: whether it is on for it). */
  readonly reaches: boolean;
  /** Whether it is on as the levels under the one edited have it. */
  readonly enabledBelow: boolean;
  /** What of the body it reaches, as in effect and as under the level edited. */
  readonly reach?: LightReach;
  readonly reachBelow?: LightReach;
  /**
   * Whose it is, to find it in the tree: the body's own (none), the scene's, or a planet's it is a
   * moon of (its path); and the overlay it is of, where it is one's (shown under the overlay).
   */
  readonly owner?: BodyPath | 'scene';
  readonly overlay?: string;
  /** Whether it was added at the level edited, to the body (it can be taken out here). */
  readonly removable?: boolean;
}

/** Whether a body's files are loaded (its overlays' too). */
export const filesLoaded = (b: BodyInfo) => !!b.file && b.overlays.every((o) => !!o.file);

/** A body's parts' materials (by `materialKey`), by part (its overlays' too). */
function partMaterialsOf(b: BodyInfo): PartMaterials {
  const opened = b.file?.kind === 'style' ? b.id : undefined;
  return new Map(
    partsOfBody(b).map((p) => [
      p.key as string,
      p.materials.map((name) => materialKey(name, p.overlay ?? opened)),
    ]),
  );
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
        ? (parts.get(receiver.slice(5)) ?? []).includes(m.key)
        : receiver === `material:${m.key}`,
  );
  // Lights light a lit material; one that darkens darkens any of a body's.
  const acts = (light: { readonly darkens: boolean }) =>
    light.darkens || shown.some((m) => m.values.lit);
  const under = lightsBelowOf(b);
  const addedBelow = new Map(addedBelowOf(b).map((l) => [l.id, l] as const));
  const lights = [
    ...lightsOfBody(b).map((e) => ({
      light: e.light,
      reach: e.reach,
      reachBelow: e.removable
        ? undefined
        : (under[e.light.id]?.reach ?? addedBelow.get(e.light.id as `added-${string}`)?.reach),
      enabledBelow: e.enabledBelow,
      owner: undefined,
      overlay: e.overlay,
      removable: e.removable,
    })),
    ...outer.map(({ light, owner, overlay }) => {
      const set = b.settings.lights?.[light.id];
      return {
        light: addedLight(light, set),
        reach: set?.reach ?? light.reach,
        reachBelow: light.reach,
        enabledBelow: true,
        owner,
        overlay,
        removable: false,
      };
    }),
  ];
  // (A body's list keeps the lights added to it here, acting or not: they can be taken out there.)
  return lights
    .filter(
      ({ light, removable }) =>
        (acts(light) || (receiver === null && removable)) && (receiver === null || light.enabled),
    )
    .map(({ light, ...l }) => ({
      id: light.id,
      kind: light.kind,
      name: light.name,
      reaches: receiver === null ? light.enabled : reachesReceiver(l.reach, receiver, parts),
      enabledBelow: l.enabledBelow,
      ...(l.reach ? { reach: l.reach } : {}),
      ...(l.reachBelow ? { reachBelow: l.reachBelow } : {}),
      ...(l.owner !== undefined ? { owner: l.owner } : {}),
      ...(l.overlay ? { overlay: l.overlay } : {}),
      ...(l.removable ? { removable: true } : {}),
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
  const own = b.below;
  const first = (...levels: [string, unknown][]) => levels.find(([, v]) => v !== undefined)?.[0];
  const library = 'the library (planet)';
  // Each overlay's say, the later's first (as it shades over the earlier's).
  const latestFirst = [...b.overlays].reverse();
  const libraryStyle = (k: 'shade' | 'shadeTowards') =>
    latestFirst.map((o): [string, unknown] => [`the library (${overlayLabel(o)})`, o.below?.[k]]);
  const worn = (k: 'strength' | 'direction') =>
    latestFirst.map((o): [string, unknown] => [
      `its tuning for ${overlayLabel(o)}`,
      wearOf(b.file, o.id)?.shade?.[k],
    ]);
  const styleOwn = (k: 'strength' | 'direction') =>
    latestFirst.map((o): [string, unknown] => [
      `the ${overlayLabel(o)} overlay`,
      o.file?.shade?.[k],
    ]);
  const out: SettingOrigins<keyof BodySettings> = {
    lighting: first([library, own?.lighting], ['its tuning', tuning?.lighting]),
    shade: first(
      ...libraryStyle('shade'),
      [library, own?.shade],
      ...worn('strength'),
      ...styleOwn('strength'),
      ['its tuning', tuning?.shade?.strength],
    ),
    tint: first([library, own?.tint], ['its tuning', tuning?.tint]),
    lightFrom: first([library, own?.lightFrom], ['its tuning', tuning?.lightFrom]),
    shadeTowards: first(
      ...libraryStyle('shadeTowards'),
      [library, own?.shadeTowards],
      ...worn('direction'),
      ...styleOwn('direction'),
      ['its tuning', tuning?.shade?.direction],
    ),
    rim: first([library, own?.rim], ['its tuning', tuning?.rim]),
    glowMargin: first([library, own?.glowMargin]),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as SettingOrigins<
    keyof BodySettings
  >;
}

/** A body as its properties show it, for an editor. */
export function bodyView(
  b: BodyInfo,
  focused: boolean,
  canHaveMoons: boolean,
  /** One of a library planet's own moons, edited there: its orbit and what it wears; its lights its own planet's. */
  libraryMoon = false,
): BodyView {
  return {
    info: b,
    values: valuesOf(b),
    changed: Object.keys(b.settings).length > 0 || inheritedChanged(b),
    inherited: !!b.inherited,
    orbitBase: b.inherited?.orbit ?? DEFAULT_ORBIT,
    lights: !libraryMoon,
    styled: canHaveMoons || libraryMoon,
    focusable: !libraryMoon,
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

/** Whether a scene sets one of its planet's own moons otherwise than the planet has it: its orbit, what it wears. */
function inheritedChanged(b: BodyInfo): boolean {
  const base = b.inherited;
  if (!base || !b.orbit) return false;
  const worn = b.overlaysSet ? b.overlays.map((o) => o.id) : undefined;
  const base_ = base.overlays;
  const wears =
    worn !== undefined &&
    (worn.length !== (base_?.length ?? -1) || worn.some((id, i) => id !== base_?.[i]));
  return (
    wears ||
    (Object.keys(DEFAULT_ORBIT) as (keyof Orbit)[]).some((k) => b.orbit![k] !== base.orbit[k])
  );
}

/**
 * The way a light comes from (`from`, in its body's frame), out of the body as the eye at `eye`
 * sees it, in the scene: a unit vector.
 */
export function wayOut(from: Vec3, body: SetPlanet, eye: Vec3): Vec3 {
  const { axes } = bodyFrame(body.position, body.radius, eye);
  const way = [0, 1, 2].map(
    (k) => from[0] * axes[k]! + from[1] * axes[3 + k]! + from[2] * axes[6 + k]!,
  );
  const length = Math.hypot(...way) || 1;
  return way.map((v) => v / length) as unknown as Vec3;
}

/** A place near a body (in its frame, in its radii) as the eye at `eye` sees it, in the scene. */
export function placeOut(at: Vec3, body: SetPlanet, eye: Vec3): Vec3 {
  const { axes } = bodyFrame(body.position, body.radius, eye);
  return [0, 1, 2].map(
    (k) =>
      body.position[k]! +
      (at[0] * axes[k]! + at[1] * axes[3 + k]! + at[2] * axes[6 + k]!) * body.radius,
  ) as unknown as Vec3;
}

/**
 * A light's marker about its body: one from all round on the body's middle; one from a side out
 * from the body on that side, a line to it from the surface; one from a point where it is, a
 * line to the nearest of the surface (the middle of what it lights); a spot where it is, a line
 * along its aim to where it meets the body (the middle of its light circle; past the body, to
 * its nearest point). `at` and, where a line is drawn, where it starts.
 */
export function lightMarkerAt(
  light: {
    readonly kind?: LightKind;
    readonly from?: Vec3;
    readonly position?: Vec3;
    readonly lookAt?: LookAt;
    readonly aim?: Vec3;
  },
  body: SetPlanet,
  eye: Vec3,
): { readonly at: Vec3; readonly from?: Vec3 } | null {
  const along = (way: Vec3, radii: number) =>
    body.position.map((v, k) => v + way[k]! * body.radius * radii) as unknown as Vec3;
  if (light.position) {
    const at = placeOut(light.position, body, eye);
    if (light.kind === 'spot') {
      const p = light.position;
      const aim = aimOf(p, light.lookAt, light.aim);
      const t = alongToSphere(p, aim);
      return {
        at,
        from: placeOut([p[0] + aim[0] * t, p[1] + aim[1] * t, p[2] + aim[2] * t], body, eye),
      };
    }
    const way = wayOut(light.position, body, eye);
    return { at, from: along(way, 1.05) };
  }
  if (light.from) {
    const way = wayOut(light.from, body, eye);
    return { at: along(way, 1.8), from: along(way, 1.05) };
  }
  return null;
}

/**
 * The edges of a spot light's cone as seen from `eye`, from the spot to the body (none for any
 * other light, or with the eye inside the cone), in the scene: drawn with its marker when it is
 * selected.
 */
export function spotEdges(
  light: BodyLight,
  body: SetPlanet,
  eye: Vec3,
): readonly (readonly [Vec3, Vec3])[] {
  const placed = placedLight(light);
  if (placed?.kind !== 'spot' || !placed.position || !placed.aim) return [];
  const frame = bodyFrame(body.position, body.radius, eye);
  return coneEdges(placed.position, placed.aim, placed.cone ?? 90, frame.eye).map(
    ([a, b]) => [placeOut(a, body, eye), placeOut(b, body, eye)] as const,
  );
}

/**
 * What the view shows of a light selected, about a body it lights, seen from `eye`: the outline
 * of where it falls on the body's sphere (any light but one from all round), and a directional
 * light's beam out of the body the way it comes from. None of a light switched off.
 */
export function lightAids(light: BodyLight, body: SetPlanet, eye: Vec3): LightAid[] {
  if (!light.enabled) return [];
  const placed = placedLight(light);
  if (!placed) return [];
  const colour = rgbOf(light.colour, 1);
  const { axes } = bodyFrame(body.position, body.radius, eye);
  const outline: LightOutline = {
    shape: 'outline',
    centre: body.position,
    radius: body.radius,
    axes,
    kind: placed.kind ? LIGHT_KINDS[placed.kind] : 0,
    direction: placed.direction,
    position: placed.position ?? [0, 0, 0],
    aim: placed.aim ?? [0, 0, 1],
    fade: placed.fade ?? 1,
    cone: placed.cone ?? 90,
    edge: placed.edge ?? 0,
    colour,
    darkens: light.darkens,
  };
  const from = placed.kind ? null : lightWay(light, body, eye);
  return from
    ? [
        {
          shape: 'beam',
          centre: body.position,
          radius: body.radius,
          from,
          colour,
          darkens: light.darkens,
        },
        outline,
      ]
    : [outline];
}

/** The way a light comes from, out of its body as seen from `eye`: a side's, or a point's or spot's place. */
export function lightWay(
  light: { readonly from?: Vec3; readonly position?: Vec3 },
  body: SetPlanet,
  eye: Vec3,
): Vec3 | null {
  const way = light.position ?? light.from;
  return way ? wayOut(way, body, eye) : null;
}

/** A body's name as shown: as renamed (the level edited's, else the library's), else its id. */
export const bodyLabel = (b: BodyInfo) => b.settings.label ?? bodyLabelBelow(b);
export const bodyLabelBelow = (b: BodyInfo) => b.below?.label ?? b.name ?? b.id;
/**
 * The overlays a body may wear, by name: the game data's (the index's styles), and those made in
 * the editor (the library's), each as renamed in the library.
 */
export function overlayChoices(index: PlanetIndex | null, library: LibraryState): PickChoice[] {
  const ids = [
    ...(index?.styles.map((s) => s.id) ?? []),
    ...Object.entries(library.created ?? {})
      .filter(([, o]) => o.kind === 'planet')
      .map(([id]) => id),
  ];
  return ids.map((id) => ({ value: id, label: overlayName(library, id) }));
}

/**
 * A body's materials' draw order with its overlays' in the order it wears them (`worn`): its own
 * first, then each overlay's, each keeping the order they are drawn in now.
 */
export function overlayOrder(
  materials: readonly MaterialEntry[],
  worn: readonly string[],
): string[] {
  return [
    ...materials.filter((m) => !m.overlay).map((m) => m.key),
    ...worn.flatMap((id) => materials.filter((m) => m.overlay === id).map((m) => m.key)),
  ];
}

/** A body's name with the overlays it wears. */
export const wornLabel = (b: BodyInfo) =>
  b.overlays.length
    ? `${bodyLabel(b)} · ${b.overlays.map(overlayLabel).join(' + ')}`
    : bodyLabel(b);

/** The sky's materials as shown: the scene file's, through what is under the layer edited and the layer edited. */
export function skyMaterialsOf(
  scene: PlayScene,
  below: SkyChoices | undefined,
  edited: SkyChoices | undefined,
  base?: MaterialSettingsMap,
  overlays: readonly SkyOverlayInfo[] = [],
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
      key: name,
      ...(material.priority !== undefined ? { priority: material.priority } : {}),
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
  // The overlays' it wears: each drawn as the sky's are, its settings the overlay's (the library's
  // for it) under the sky's. Its own parts (added onto it: the overlay with no id) draw its own.
  for (const o of overlays)
    for (const part of o.file?.parts ?? [])
      for (const name of part.materials) {
        const material = o.file?.materials[name];
        const key = materialKey(name, o.id || undefined);
        if (!material || out.some((m) => m.key === key)) continue;
        const levels = [
          ['the library (material)', base?.[name]],
          [`the library (${skyOverlayLabel(o)})`, o.below?.materials?.[key]],
          ['the library (sky)', below?.materials?.[key]],
        ] as const;
        const under = mergeSettings(...levels.map(([, l]) => l));
        const settings = mergeSettings(under, edited?.materials?.[key]);
        const textures = { ...scene.textures, ...o.file?.textures };
        const named = under?.label ?? materialLabel(name, material, textures);
        out.push({
          name,
          key,
          ...(material.priority !== undefined ? { priority: material.priority } : {}),
          label: edited?.materials?.[key]?.label ?? named,
          labelBelow: named,
          ...(o.id
            ? { from: 'style' as const, overlay: o.id }
            : { from: 'own' as const, added: true }),
          origins: originsOf(levels),
          values: materialValues(material, settings, skyDepths(scene)[name]),
          enabledBelow: under?.enabled ?? MATERIAL_DEFAULTS.enabled,
          controls: materialControls(material, { particles: false, sky: true }),
          set: edited?.materials?.[key],
          baseTint: under?.tint ?? NO_MATERIAL_TINT,
          layers: layersOf(material, settings, edited?.materials?.[key], levels, textures),
        });
      }
  return inDrawOrder(out, edited?.order ?? below?.order);
}

/**
 * An overlay a sky wears, as an editor has it: which, its name (as made, or as the data names it),
 * its settings under the level edited (the library's for it), and its file.
 */
export interface SkyOverlayInfo {
  readonly id: string;
  readonly name?: string;
  readonly below?: BodySettings;
  readonly file?: SkyOverlayFile;
}

/**
 * The overlays a sky wears (by id, in order) as an editor has them: each one's file, the data's or
 * made (its materials found by `lookup`).
 */
export function skyOverlayInfos(
  scene: PlayScene | null,
  library: LibraryState,
  worn: readonly string[],
  lookup: SourceLookup,
): SkyOverlayInfo[] {
  return worn.map((id) => {
    const made = library.created?.[id];
    const file = made?.kind === 'sky' ? createdSkyFile(made, lookup) : scene?.overlays?.[id];
    const name = made?.label ?? file?.label;
    return {
      id,
      ...(name ? { name } : {}),
      below: library.styles[id],
      ...(file ? { file } : {}),
    };
  });
}

/** The overlays a sky may wear, by name: the game data's (the scene's), and those made in the editor for skies. */
export function skyOverlayChoices(scene: PlayScene | null, library: LibraryState): PickChoice[] {
  return [
    ...Object.entries(scene?.overlays ?? {}).map(([id, file]) => ({
      value: id,
      label: library.styles[id]?.label ?? file.label ?? id,
    })),
    ...Object.entries(library.created ?? {})
      .filter(([, o]) => o.kind === 'sky')
      .map(([id]) => ({ value: id, label: overlayName(library, id) })),
  ];
}

/** A sky overlay's name: as renamed in the library, else as made or as its data names it, else its id. */
export const skyOverlayLabel = (o: SkyOverlayInfo) => o.below?.label ?? o.name ?? o.id;

/**
 * A sky overlay's parts as shown: each one's settings in effect (the overlay's own, the library
 * sky's for it, `below`; then the level edited's) about the eye. One made in the editor is a band
 * named by its id; the data's, by the overlay's name.
 */
export function skyPartsOf(
  o: SkyOverlayInfo,
  below: PartSettingsMap | undefined,
  edited: PartSettingsMap | undefined,
  /** Whether the overlay is the one open (its parts are its own, not another's it wears). */
  own = false,
  /** The parts added at the level edited, by id (the sky's own: `o` with no id). */
  addedHere: readonly string[] = [],
): PartEntry[] {
  const levels: [string, PartSettingsMap | undefined][] = [
    [`the library (${skyOverlayLabel(o)})`, o.below?.parts],
    ['the library (sky)', below],
  ];
  const parts = o.file?.parts ?? [];
  return parts.map((part): PartEntry => {
    const key: PartKey = o.id
      ? overlayPartKey(o.id, { id: part.id, role: 'band' })
      : `own:${part.id}`;
    const under = mergePartSettings(...levels.map(([, l]) => l))[key];
    const settings = mergePartSettings(...levels.map(([, l]) => l), edited)[key];
    const band = part.shape.kind === 'band';
    const named = under?.label ?? (band || !o.id ? idLabel(part.id) : skyOverlayLabel(o));
    return {
      key,
      label: settings?.label ?? named,
      labelBelow: named,
      from: 'style',
      kind: 'sky',
      band,
      values: {
        size: settings?.size ?? 1,
        turn: settings?.turn ?? 0,
        tilt: settings?.tilt ?? 0,
        width: settings?.width ?? 1,
        height: settings?.height ?? 1,
        depth: 0,
        mid: 0.5,
        keepToLimb: false,
        flip: false,
        side: 'near',
        from: 0,
        repeat: 1,
      },
      set: edited?.[key],
      origins: originsOf(levels.map(([name, l]) => [name, l?.[key]] as const)),
      canKeepToLimb: false,
      materials: part.materials,
      enabled: settings?.enabled ?? true,
      enabledBelow: under?.enabled ?? true,
      ...(o.id ? { overlay: o.id } : {}),
      ...(own || !o.id ? {} : { overlayName: skyOverlayLabel(o) }),
      ...(!o.id && addedHere.includes(part.id) ? { added: true } : {}),
    };
  });
}

/** A sky's own parts (added onto it), as the overlays it wears are had: one with no id. */
export const ownSkyInfo = (file: SkyOverlayFile | undefined): SkyOverlayInfo => ({
  id: '',
  ...(file ? { file } : {}),
});

/** Materials as shown, in the order they are drawn (see `drawOrder`). */
function inDrawOrder(
  entries: readonly MaterialEntry[],
  order: readonly string[] | undefined,
): MaterialEntry[] {
  const keys = drawOrder(
    entries.map((m) => ({ name: m.key, blend: m.values.blend, priority: m.priority })),
    order,
  );
  return [...entries].sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
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
    key: name,
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

/**
 * What of a material a row shows, where it isn't the material itself: one of its layers; the
 * shield shader it is drawn with (its pattern); one of that shader's lights (by its id).
 */
export type MaterialView =
  | { readonly kind: 'layer'; readonly slot: LayerSlot }
  | { readonly kind: 'shader' }
  | { readonly kind: 'gridLight'; readonly id: GridLight['id'] };

const VIEW = '::';

/** A row's key for what of a material it shows (its own key and the view after `::`). */
export function viewKey(materialKey: string, view: MaterialView): string {
  const what =
    view.kind === 'layer'
      ? `layer:${view.slot}`
      : view.kind === 'gridLight'
        ? `light:${view.id}`
        : 'shader';
  return `${materialKey}${VIEW}${what}`;
}

/** A shield shader's groups' keys (they only fold): its materials, its lights. */
export const shaderGroupKey = (materialKey: string, group: 'materials' | 'lights') =>
  `${materialKey}${VIEW}group:${group}`;

/**
 * A row's key split into its material's and what of it it shows; a shader's group's into its
 * material's and `group`; none where it is a material's own (or not a material's at all).
 */
export function splitViewKey(
  key: string,
): { readonly base: string; readonly view: MaterialView | 'group' } | null {
  const at = key.lastIndexOf(VIEW);
  if (at < 0) return null;
  const base = key.slice(0, at);
  const what = key.slice(at + VIEW.length);
  if (what === 'shader') return { base, view: { kind: 'shader' } };
  if (what.startsWith('group:')) return { base, view: 'group' };
  if (what.startsWith('light:grid-'))
    return { base, view: { kind: 'gridLight', id: what.slice(6) as GridLight['id'] } };
  if (what.startsWith('layer:')) {
    const slot = what.slice(6) as LayerSlot;
    return LAYER_SLOTS.includes(slot) ? { base, view: { kind: 'layer', slot } } : null;
  }
  return null;
}

const LAYER_SLOTS: readonly LayerSlot[] = ['diffuse', 'emissive', 'mask1', 'mask2'];

/** A view's title: its shader, its light, or its layer (by the material's own name for it, where given). */
export function viewTitle(view: MaterialView, m?: MaterialEntry): string {
  if (view.kind === 'shader') return 'Shield shader';
  if (view.kind === 'gridLight')
    return m?.values.gridLights.find((l) => l.id === view.id)?.name ?? 'Light';
  const layer = m?.layers.find((l) => l.slot === view.slot)?.label ?? LAYER_NAMES[view.slot];
  return m ? `${m.label} · ${layer}` : layer;
}

/** A material's layers as rows under its own (each showing that layer). */
export function layerRows(materialKey: string, m: MaterialEntry, depth: number): TreeRow[] {
  return m.layers.map((l) => ({
    key: viewKey(materialKey, { kind: 'layer', slot: l.slot }),
    label: l.label,
    icon: 'layers',
    depth,
    expandable: false,
    expanded: false,
  }));
}

/**
 * A material's row key with the part it is drawn on after it (`#`), where the same material is
 * drawn on more than one of a list's parts (each its own row; its settings, by name, still shared).
 */
export const onPart = (key: string, part?: string) => (part ? `${key}#${part}` : key);

/** A material's name from its row key's (the part it is on, where given, left off). */
export const offPart = (name: string) => name.split('#')[0] ?? name;

/** The materials drawn on more than one of these parts (their rows told apart by part). */
export function sharedMaterials(
  list: readonly { readonly materials: readonly { readonly name: string }[] }[],
): ReadonlySet<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const { materials } of list)
    for (const name of new Set(materials.map((m) => m.name)))
      (seen.has(name) ? shared : seen).add(name);
  return shared;
}

/**
 * A part's materials as rows under it: a shield's (a grid's) under its shader, the shader's
 * materials and its lights (where it shows, where it is active) under that, each its own row
 * (open unless folded: their keys among those kept mean folded); any other part's materials
 * right under it. Each material's row is the editor's own (`material`, at a depth), its layers
 * under it.
 */
export function partMaterialRows(
  materials: readonly MaterialEntry[],
  depth: number,
  open: ReadonlySet<string>,
  keyOf: (name: string) => string,
  material: (key: string, m: MaterialEntry, depth: number) => void,
  push: (row: TreeRow) => void,
): void {
  const grid = materials.find((m) => m.controls.colours);
  if (!grid) {
    for (const m of materials) material(keyOf(m.name), m, depth);
    return;
  }
  const base = keyOf(grid.name);
  const shader = viewKey(base, { kind: 'shader' });
  push({
    key: shader,
    label: 'Shield shader',
    icon: 'hexagon',
    depth,
    expandable: true,
    expanded: !open.has(shader),
  });
  if (open.has(shader)) return;
  const group = (which: 'materials' | 'lights', label: string, icon: string) => {
    const key = shaderGroupKey(base, which);
    push({
      key,
      label,
      icon,
      depth: depth + 1,
      expandable: true,
      expanded: !open.has(key),
      group: true,
    });
    return !open.has(key);
  };
  if (group('materials', 'Materials', 'texture'))
    for (const m of materials) material(keyOf(m.name), m, depth + 2);
  if (group('lights', 'Lights', 'lightbulb'))
    for (const l of grid.values.gridLights)
      push({
        key: viewKey(base, { kind: 'gridLight', id: l.id }),
        label: l.name,
        icon: lightIcon(l),
        depth: depth + 2,
        expandable: false,
        expanded: false,
        enabled: l.enabled ?? true,
      });
}
