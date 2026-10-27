import {
  overlayPartKey,
  ownPartKey,
  PartKey,
  type PartRole,
  type PlanetFile,
  reordered,
  type SceneMaterial,
  type SceneTexture,
  wearOf,
  withMasks,
  wornParts,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  type LayerSettings,
  type LayerSlot,
  layerSlots,
  MATERIAL_DEFAULTS,
  type MaterialDepth,
  materialKey,
  type MaterialSettings,
  type MaterialSettingsMap,
  type MaterialTint,
  type MaterialValues,
  materialValues,
  mergeMaterialSettings,
  mergeSettings,
  NO_MATERIAL_TINT,
  withLayer,
} from '@myrddraall/heroes-replay-stats-aether/materials';
import {
  type BodyInfo,
  type WornOverlay,
  bodyOrientation,
  drawnOverlays,
  overlayLabel,
  ownLevels,
  ownSetting,
} from '../bodies/body';
import { opaque, partNodes, partsInDrawOrder, partTurnOf, placingMaterials } from '../parts/parts';
import { inDrawOrder } from '../sky/sky';
import { type MaterialControls, materialControls } from './material-controls';
import { materialLabel, textureLabel } from './material-names';
import { originsOf, type SettingOrigins } from '../editing/setting-origins';

/** A body's materials as an editor shows them: their values through the layers, their layers and textures. */

/** A texture a material's layer reads: which layer, where the site has it, where the game data has it. */
export interface TextureEntry {
  readonly layer: string;
  /** Its file in the game data the site serves (under `DATA_URL`). */
  readonly file: string;
  /** Its path in the game data, where the export says. */
  readonly source?: string;
  readonly baked: boolean;
  readonly width: number;
  readonly height: number;
}

/** A material as its properties show it: its settings as shown, what is set in the layer edited, which controls do anything, the textures it reads. */
export interface MaterialEntry {
  /** Which level over the one edited wins for each of its settings, where one sets it (see `BodyInfo.above`). */
  readonly overrides?: SettingOrigins<keyof MaterialSettings>;
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
  /** Whether its body's own turn (its Axis and Turn) turns it (a halo left square to the camera: not; see `DrawTurn`). */
  readonly turned?: boolean;
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
  /** Which level over the one edited wins for each of its settings, where one sets it. */
  readonly overrides?: SettingOrigins<keyof LayerSettings>;
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
  /** What is set over the level edited (see `BodyInfo.above`): what wins over it. */
  above: readonly (readonly [string, MaterialSettings | undefined])[] = [],
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
      overrides: originsOf(above.map(([name, l]) => [name, l?.layers?.[slot]] as const)),
      texture: info && key ? textureEntry(LAYER_NAMES[slot], info) : undefined,
      choices:
        key && !choices.some((c) => c.key === key)
          ? [{ key, label: textureLabel(key, info) }, ...choices]
          : choices,
    };
  });
}

export const LAYER_NAMES: Record<LayerSlot, string> = {
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
    file: texture.file,
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
                ...ownLevels(b).map((l): readonly [string, MaterialSettings | undefined] => [
                  l.name,
                  l.settings?.materials?.[key],
                ]),
              ]
            : [
                ['its tuning', owner.tuning?.materials?.[name]],
                ['the library (material)', b.materialBase?.[name]],
                // What the overlays it wears set for its own materials (the later over the
                // earlier), under its own.
                ...drawnOverlays(b).map((o): readonly [string, MaterialSettings | undefined] => [
                  `the library (${overlayLabel(o)})`,
                  o.below?.materials?.[key],
                ]),
                ...ownLevels(b).map((l): readonly [string, MaterialSettings | undefined] => [
                  l.name,
                  l.settings?.materials?.[key],
                ]),
              ];
          const under = mergeSettings(...levels.map(([, l]) => l));
          const settings = mergeSettings(under, chosen?.[key]);
          // Which way it is turned: its own say, else its part's, else a halo square to the
          // camera, else its body's; and where that is said, where it isn't its own.
          const part = (overlay ? wornParts(b.file, overlay.id, owner.parts) : owner.parts).find(
            (p) => p.materials.includes(name),
          );
          const partKey =
            part &&
            (overlay || opened ? overlayPartKey(overlay?.id ?? opened!, part) : ownPartKey(part));
          const drawn =
            part && partKey
              ? partTurnOf(b, owner, part, partKey, settings?.orientation)
              : undefined;
          const values = {
            ...materialValues(material, settings),
            orientation: drawn?.orientation ?? settings?.orientation ?? bodyOrientation(b),
          };
          const origins = originsOf(levels);
          const above = (b.above ?? []).map(
            (l): readonly [string, MaterialSettings | undefined] => [
              l.name,
              l.settings?.materials?.[key],
            ],
          );
          const turnOrigin = settings?.orientation === undefined ? drawn?.origin : undefined;
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
            origins: turnOrigin ? { ...origins, orientation: turnOrigin } : origins,
            overrides: originsOf(above),
            values,
            turned: drawn?.turned ?? true,
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
              above,
            ),
          };
        })
      : [],
  );
  // In the order they are drawn (the tree's order): the level edited's, else what is under it.
  const orders = b.overlays.flatMap((o) => (o.below?.order ? [o.below.order] : []));
  const order =
    b.settings.order ?? ownSetting(b, 'order') ?? (orders.length ? orders.flat() : undefined);
  return inDrawOrder(entries, order);
}

/**
 * A body's materials' draw order (by key) with one moved to just before (or after) another drawn
 * on the same part and drawn as it is, opaque or blended (a material isn't moved to another part,
 * nor past the opaque/blended line: none).
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
  // (Among those drawn as it is: the opaque before the blended, whatever is moved.)
  const target = node?.materials.find((m) => m.key === to);
  const group = node?.materials.filter((m) => opaque(m) === opaque(target!)).map((m) => m.key);
  if (!group?.includes(from)) return undefined;
  return reordered(
    all.map((m) => m.key),
    group,
    from,
    to,
    after,
  );
}

/**
 * A body's materials' draw order (by key) with a part's moved to just before (or after) another
 * part's: the materials that place it together (see `placingMaterials`), where the other's are
 * (none: the two aren't drawn alike, opaque alone or not, or there is nothing to move).
 */
export function movedShape(
  b: BodyInfo,
  all: readonly MaterialEntry[],
  from: PartKey,
  to: PartKey,
  after: boolean,
): string[] | undefined {
  const nodes = partsInDrawOrder(b, all);
  const placing = (key: PartKey) => {
    const node = nodes.find((n) => n.part.key === key);
    return node ? placingMaterials(node) : [];
  };
  // (A part drawn opaque alone is moved among those like it: the opaque are drawn first.)
  const from_ = placing(from);
  const to_ = placing(to);
  if (!from_.length || !to_.length || opaque(from_[0]!) !== opaque(to_[0]!)) return undefined;
  const moving = from_.map((m) => m.key);
  const target = to_.map((m) => m.key).filter((k) => !moving.includes(k));
  if (!target.length || from === to) return undefined;
  const order = all.map((m) => m.key).filter((k) => !moving.includes(k));
  const at = after ? order.indexOf(target.at(-1)!) + 1 : order.indexOf(target[0]!);
  order.splice(at, 0, ...moving);
  return order;
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
