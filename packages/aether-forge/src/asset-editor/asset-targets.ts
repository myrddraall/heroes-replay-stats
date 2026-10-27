import {
  type BodyPath,
  moonAt,
  type MoonChoices,
  pathKey,
  pathOf,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { PartKey, SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { LightId, Receiver } from '@myrddraall/heroes-replay-stats-aether/lights';
import { materialKey } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { LibraryKind } from '../draft/design-writes';
import { offPart } from '../materials/materials';
import { type MaterialView, splitViewKey } from '../materials/material-views';
import { REFERENCE_KEY } from '../aids/editing-aids.store';
import type { AssetKind, AssetTarget } from '../layout/open-target';
/** The planet a style, a material or the sky is shown on, until a planet has been opened. */
export const DEFAULT_PREVIEW_PLANET = 'korhal';

/** Where the asset is put on the stage: as a scene's planet is. */
export const PREVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];

export const PREVIEW_RADIUS = 18;

/** The asset tree's rows by what they are. */
export const STAGE = 'stage';

export const STAGE_SKY = 'stage/sky';

export const STAGE_BACKDROP = 'stage/backdrop';

export const STAGE_STAND_IN = 'stage/stand-in';

/** The stand-in's own lights, under it. */
export const standInLightKey = (id: LightId) => `${STAGE_STAND_IN}/l/${id}`;

export const ASSET = 'asset';

/** One of the planet open's own moons, by its path among them. */
export const moonKey = (path: BodyPath) => `${ASSET}/moon/${pathKey(path)}`;

/** The paths of moons (theirs after each), in the order they are placed. */
export const moonPaths = (moons: readonly MoonChoices[], under: BodyPath = []): BodyPath[] =>
  moons.flatMap((m, i) => [[...under, i], ...moonPaths(m.moons ?? [], [...under, i])]);

/** A key for a new moon among a planet's own: `moon-<n>`, past those there are. */
export function nextMoonKey(moons: readonly MoonChoices[]): string {
  const n = moonPaths(moons)
    .map((p) => moonAt(moons, p)?.key ?? '')
    .map((k) => Number(/^moon-(\d+)$/.exec(k)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `moon-${n + 1}`;
}

/** An overlay the planet open wears, by id: its parts and its lights, under it. */
export const assetOverlayKey = (id: string) => `asset/overlay/${id}`;

export const assetOverlayLightsKey = (id: string) => `asset/overlay-lights/${id}`;

export const stageMaterialKey = (name: string) => `${STAGE_SKY}/m/${name}`;

/**
 * A sky's overlays' rows (the stage's sky's, or the sky open's): an overlay it wears (its parts
 * under it), one of their parts (its materials under it), one of their materials.
 */
export const skyRowKeys = (stage: boolean) => {
  const at = stage ? STAGE_SKY : `${ASSET}/sky`;
  return {
    overlay: (id: string) => `${at}/overlay/${id}`,
    part: (key: PartKey) => `${at}/p/${key}`,
    material: (overlay: string, name: string) => `${at}/om/${overlay}/${name}`,
  };
};

/** A sky's materials at a depth (background, midground, foreground), a group of their own: the sky open's, the stage's. */
export const assetDepthKey = (depth: string) => `${ASSET}/depth/${depth}`;

export const stageDepthKey = (depth: string) => `${STAGE_BACKDROP}/depth/${depth}`;

export const assetMaterialKey = (name: string) => `${ASSET}/m/${name}`;

/** A material of an overlay the planet open wears (two may share one). */
export const assetOverlayMaterialKey = (overlay: string, name: string) =>
  `${ASSET}/om/${overlay}/${name}`;

export const assetPartKey = (key: PartKey) => `${ASSET}/p/${key}`;

/** Its lights (its rig's, its shadow, those added), a group of their own. */
export const ASSET_LIGHTS = 'asset/lights';

export const assetLightKey = (id: LightId) => `${ASSET}/l/${id}`;

export const KIND_TITLES: Readonly<Record<AssetKind, string>> = {
  planet: 'Planet',
  style: 'Overlay',
  material: 'Material',
  particle: 'Particles',
  sky: 'Sky',
};

/** What an asset tree row's key is, for the asset open. */
export type Target =
  /**
   * A group of rows: an overlay the planet open wears (`overlay`: which), its lights, a sky's
   * depths, an overlay a sky wears (`skyOverlay`: which; the stage's sky's or the sky open's).
   */
  | {
      readonly kind: 'group';
      readonly overlay?: string;
      readonly skyOverlay?: string;
      readonly stage?: boolean;
    }
  /** The stage's sky, or the library's (the sky open). */
  | { readonly kind: 'sky'; readonly stage: boolean }
  | {
      readonly kind: 'sky-material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly stage: boolean;
      readonly name: string;
      /** The overlay the sky wears it is of, where it is one's (else the sky's own). */
      readonly overlay?: string;
      readonly view?: MaterialView;
    }
  /** A part of an overlay a sky wears (the stage's, or the sky open's). */
  | { readonly kind: 'sky-part'; readonly stage: boolean; readonly key: PartKey }
  /** The planet or style open. */
  | { readonly kind: 'body' }
  /** One of the planet open's own moons, by its path among them. */
  | { readonly kind: 'moon'; readonly path: BodyPath }
  /** A material as the planet or overlay open sets it for itself (`overlay`: of one it wears). */
  | {
      readonly kind: 'material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly name: string;
      readonly overlay?: string;
      readonly view?: MaterialView;
    }
  /** One of the planet's or style's parts. */
  | { readonly kind: 'part'; readonly key: PartKey }
  /** One of the planet's or style's lights. */
  | { readonly kind: 'light'; readonly id: LightId }
  /** The material open: its base settings. */
  | { readonly kind: 'base-material'; readonly view?: MaterialView }
  | { readonly kind: 'particle' }
  /** The editing aids: the stage's backdrop, the stand-in planet. */
  | { readonly kind: 'backdrop' }
  | { readonly kind: 'stand-in' }
  /** One of the stand-in's lights (an editing aid's: kept with the aids, never in the design). */
  | { readonly kind: 'stand-in-light'; readonly id: LightId }
  | { readonly kind: 'reference' };

/** What of the body open a target is, as a light reaches it: the body (none), a part or a material; not one (undefined). */
export function receiverOf(t: Target): Receiver | null | undefined {
  if (t.kind === 'body') return null;
  if (t.kind === 'part') return `part:${t.key}`;
  if (t.kind === 'material') return `material:${t.key}`;
  return undefined;
}

export function targetOf(key: string, asset: AssetTarget): Target {
  // What of a material a row shows (a layer, its shader, an effect), or a shader's group.
  const split = splitViewKey(key);
  if (split) {
    const t = targetOf(split.base, asset);
    if (split.view === 'group') return { kind: 'group' };
    return t.kind === 'material' || t.kind === 'sky-material' || t.kind === 'base-material'
      ? { ...t, view: split.view }
      : t;
  }
  // A sky's overlays' rows (the stage's sky's, or the sky open's).
  for (const stage of [true, false]) {
    const at = stage ? `${STAGE_SKY}/` : `${ASSET}/sky/`;
    if (!key.startsWith(at)) continue;
    const rest = key.slice(at.length);
    if (rest.startsWith('overlay/'))
      return { kind: 'group', skyOverlay: rest.slice('overlay/'.length), stage };
    if (rest.startsWith('p/')) return { kind: 'sky-part', stage, key: rest.slice(2) as PartKey };
    if (rest.startsWith('om/')) {
      const [overlay = '', ...parts] = rest.slice(3).split('/');
      const name = parts.join('/');
      return { kind: 'sky-material', stage, name, key: materialKey(name, overlay), overlay };
    }
  }
  if (key === STAGE_BACKDROP) return { kind: 'backdrop' };
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key === STAGE_STAND_IN) return { kind: 'stand-in' };
  if (key.startsWith(`${STAGE_STAND_IN}/l/`))
    return { kind: 'stand-in-light', id: key.slice(STAGE_STAND_IN.length + 3) as LightId };
  if (key.startsWith(`${STAGE_SKY}/m/`)) {
    const name = key.slice(STAGE_SKY.length + 3);
    return { kind: 'sky-material', stage: true, name, key: name };
  }
  if (key.startsWith(`${ASSET}/moon/`))
    return { kind: 'moon', path: pathOf(key.slice(ASSET.length + 6)) };
  if (key === ASSET)
    switch (asset.kind) {
      case 'planet':
      case 'style':
        return { kind: 'body' };
      case 'material':
        return { kind: 'base-material' };
      case 'particle':
        return { kind: 'particle' };
      case 'sky':
        return { kind: 'sky', stage: false };
    }
  if (key.startsWith(`${ASSET}/p/`))
    return { kind: 'part', key: key.slice(ASSET.length + 3) as PartKey };
  if (key.startsWith(`${ASSET}/l/`))
    return { kind: 'light', id: key.slice(ASSET.length + 3) as LightId };
  if (key.startsWith(`${ASSET}/m/`)) {
    const name = offPart(key.slice(ASSET.length + 3));
    // An overlay open: its own materials are kept as the overlay's (see `materialKey`).
    if (asset.kind === 'style') return { kind: 'material', name, key: materialKey(name, asset.id) };
    return asset.kind === 'planet'
      ? { kind: 'material', name, key: name }
      : { kind: 'sky-material', stage: false, name, key: name };
  }
  if (key.startsWith(`${ASSET}/om/`)) {
    const [overlay = '', ...parts] = key.slice(ASSET.length + 4).split('/');
    const name = offPart(parts.join('/'));
    return { kind: 'material', name, key: materialKey(name, overlay), overlay };
  }
  if (key.startsWith(`${ASSET}/overlay/`))
    return { kind: 'group', overlay: key.slice(ASSET.length + 9) };
  return { kind: 'group' };
}

/** The library's list a planet or style is kept in. */
export const libraryKind = (kind: AssetKind): LibraryKind | null =>
  kind === 'planet' ? 'planets' : kind === 'style' ? 'styles' : null;

export interface AssetEditorState {
  readonly asset: AssetTarget;
  /** The selected row's key. */
  readonly selected: string;
  /** The planet on the stage: the last opened (a style, a material, the sky are shown on it). */
  readonly previewPlanet: string;
  /** A material opened from a planet or overlay: shown on the stand-in instead of on that. */
  readonly onStandIn: boolean;
  /** Where the editor's own camera is, over the game's (none: there): the stage seen from any side; not kept. */
  readonly editorCamera: SceneCameraSet | null;
  /**
   * The variant of the planet open that is edited (what is set goes into it; see `variantOpen`),
   * none: the planet's own settings.
   */
  readonly variantEdited: string | null;
}
