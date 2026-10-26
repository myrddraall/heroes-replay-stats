import {
  type BodySettings,
  createdSkyFile,
  type LibraryState,
  overlayName,
  type SkyChoices,
  type SourceLookup,
} from '@myrddraall/heroes-replay-stats-aether/design';
import {
  drawOrder,
  type MaterialDepth,
  type MaterialSettingsMap,
  mergePartSettings,
  overlayPartKey,
  type PartKey,
  type PartSettingsMap,
  type PlayScene,
  type SkyAnchor,
  type SkyOverlayFile,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  MATERIAL_DEFAULTS,
  materialControls,
  materialKey,
  materialLabel,
  materialValues,
  mergeMaterialSettings,
  mergeSettings,
  NO_MATERIAL_TINT,
  originsOf,
} from '@myrddraall/heroes-replay-stats-aether/materials';
import { DEFAULT_SKY_ANCHOR, skyDepths } from '@myrddraall/heroes-replay-stats-aether/sky';
import {
  DEFAULT_ORIENTATION,
  type Orientation,
} from '@myrddraall/heroes-replay-stats-aether/space';
import type { PickChoice } from '../../controls/pick-list';
import { type MaterialEntry, layersOf } from './materials';
import { type PartEntry, idLabel } from './parts';

/** The sky as an editor shows it: its materials, overlays, parts, depths and anchoring. */

/** The sky's materials as shown: the scene file's, through what is under the layer edited and the layer edited. */
export function skyMaterialsOf(
  scene: PlayScene,
  below: SkyChoices | undefined,
  edited: SkyChoices | undefined,
  base?: MaterialSettingsMap,
  overlays: readonly SkyOverlayInfo[] = [],
): MaterialEntry[] {
  const out: MaterialEntry[] = [];
  // Each material anchored as the sky is, where none of its levels says otherwise.
  const anchor = skyAnchorView(below, edited).value;
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
        anchor,
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
          values: materialValues(material, settings, skyDepths(scene)[name], anchor),
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
        orientation: DEFAULT_ORIENTATION,
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
export function inDrawOrder(
  entries: readonly MaterialEntry[],
  order: readonly string[] | undefined,
): MaterialEntry[] {
  const keys = drawOrder(
    entries.map((m) => ({ name: m.key, blend: m.values.blend, priority: m.priority })),
    order,
  );
  return [...entries].sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
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

/** The ways a body's surfaces can be turned, as the editor offers them. */
export const ORIENTATION_CHOICES: readonly {
  readonly value: Orientation;
  readonly label: string;
}[] = [
  { value: 'camera', label: 'Camera' },
  { value: 'world', label: 'World' },
];

/** The anchors a sky or its material may be given, as their choices show them. */
export const SKY_ANCHOR_CHOICES: readonly { readonly value: SkyAnchor; readonly label: string }[] =
  [
    { value: 'world', label: 'World' },
    { value: 'position', label: 'Camera position' },
    { value: 'camera', label: 'Camera' },
  ];

/**
 * How a sky is anchored against the camera, as its panel shows it: its anchor, what the layer
 * edited sets (none: nothing), and which level under it sets it, where one does.
 */
export interface SkyAnchorView {
  readonly value: SkyAnchor;
  readonly set?: SkyAnchor;
  readonly origin?: string;
}

/** A sky's anchor as shown: the layer edited's, over the level under it (`belowName`), over the world. */
export function skyAnchorView(
  below: SkyChoices | undefined,
  edited: SkyChoices | undefined,
  belowName = 'the library (sky)',
): SkyAnchorView {
  const set = edited?.anchor;
  const under = below?.anchor;
  return {
    value: set ?? under ?? DEFAULT_SKY_ANCHOR,
    ...(set ? { set } : {}),
    ...(under ? { origin: belowName } : {}),
  };
}

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
