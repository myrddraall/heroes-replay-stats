import {
  type BodyPart,
  haloLike,
  mergePartSettings,
  overlayPartKey,
  ownPartKey,
  type PartKey,
  type PartRole,
  type PartSettings,
  type PartSettingsMap,
  type PlanetFile,
  wornParts,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  type DrawTurn,
  drawTurnOf,
  type Orientation,
} from '@myrddraall/heroes-replay-stats-aether/space';
import {
  type BodyInfo,
  type WornOverlay,
  bodyLabel,
  bodySays,
  overlayLabel,
  overridesOf,
  ownLevels,
} from '../bodies/body';
import type { MaterialEntry } from '../materials/materials';
import { originsOf, type SettingOrigins } from '../editing/setting-origins';

/** A body's parts as an editor shows them: their values, icons and names, in the tree's order. */

/** A body's parts' settings in effect: those under the layer edited (its own, its overlays'), then the layer edited's. */
const partSettingsOf = (b: BodyInfo): PartSettingsMap =>
  mergePartSettings(
    ...b.overlays.map((o) => o.below?.parts),
    ...ownLevels(b).map((l) => l.settings?.parts),
    b.settings.parts,
  );

/**
 * Which way a draw of a body's part is turned (`drawTurnOf`): its material's say (`material`),
 * its part's (through the levels, the one edited too), the part as a halo, its body's. And where
 * that is said, as an origin shows it, where it is neither the material's nor the part's own: its
 * part's name (it set it, or is a halo), or its body's.
 */
export function partTurnOf(
  b: BodyInfo,
  owner: PlanetFile,
  part: BodyPart,
  key: PartKey,
  material?: Orientation,
): DrawTurn & { readonly origin?: string } {
  const set = partSettingsOf(b)[key];
  const halo = haloLike(part, owner.materials);
  const drawn = drawTurnOf(material, set?.orientation, halo, bodySays(b));
  const partSays = set?.orientation !== undefined || halo;
  const origin = partSays
    ? (set?.label ?? partLabelOf(part))
    : bodySays(b)
      ? bodyLabel(b)
      : undefined;
  return origin ? { ...drawn, origin } : drawn;
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
  /** Which way it is turned: its own, else its body's (a sky's part: always as the sky is). */
  readonly orientation: Orientation;
}

/** A body's part as its properties show it. */
export interface PartEntry {
  /** Which level over the one edited wins for each of its settings, where one sets it. */
  readonly overrides?: SettingOrigins<keyof PartSettings>;
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

/** A part's name unless renamed: made from its id where it has one, else its role's. */
const partLabelOf = (part: { readonly id?: string; readonly role: PartRole }) =>
  part.id ? idLabel(part.id) : PART_NAMES[part.role];

/** A part of the game data's name: its role's (Surface, Shell, Ring…). */
export const partName = (part: { readonly role: PartRole }) => PART_NAMES[part.role];

/** A part's name made from its id, where it has one (an overlay's made in the editor: `ring-2`, Ring 2). */
export const idLabel = (id: string) => {
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
  const owners: [readonly BodyPart[], string | undefined, PlanetFile | undefined][] = [
    [b.file?.parts ?? [], undefined, b.file],
    ...b.overlays.map((o): [readonly BodyPart[], string, PlanetFile | undefined] => [
      o.file ? wornParts(b.file, o.id, o.file.parts) : [],
      o.id,
      o.file,
    ]),
  ];
  // The overlays' (shared, the later over the earlier), then its own.
  const levels: [string, PartSettingsMap | undefined][] = [
    ...b.overlays.map((o): [string, PartSettingsMap | undefined] => [
      `the library (${overlayLabel(o)})`,
      o.below?.parts,
    ]),
    ...ownLevels(b).map((l): [string, PartSettingsMap | undefined] => [l.name, l.settings?.parts]),
  ];
  return owners.flatMap(([parts, overlay, owner]) =>
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
      const named = below?.label ?? partLabelOf(part);
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
          orientation: drawTurnOf(
            undefined,
            settings?.orientation,
            !!owner && haloLike(part, owner.materials),
            bodySays(b),
          ).orientation,
        },
        set,
        overrides: overridesOf(b, (s) => s?.parts?.[key]),
        origins: {
          ...originsOf(levels.map(([name, l]) => [name, l?.[key]] as const)),
          // Its body's say, where it is neither its own nor it a halo.
          ...(settings?.orientation === undefined &&
          !(owner && haloLike(part, owner.materials)) &&
          bodySays(b)
            ? { orientation: bodyLabel(b) }
            : {}),
        },
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
