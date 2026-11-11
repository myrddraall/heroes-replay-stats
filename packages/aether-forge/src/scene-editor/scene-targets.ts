import {
  type BodyPath,
  type CameraPlacement,
  type MoonChoices,
  pathKey,
  pathOf,
  type SceneBody,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { PartKey, SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { LightId, Receiver } from '@myrddraall/heroes-replay-stats-aether/lights';
import { materialKey } from '@myrddraall/heroes-replay-stats-aether/materials';
import { BODY_CATEGORIES, BodyCategory, type BodyInfo, stackedSetting } from '../bodies/body';
import { type MaterialView, splitViewKey } from '../materials/material-views';
import { offPart } from '../materials/materials';
import { REFERENCE_KEY } from '../aids/editing-aids.store';
/** The scene tree's rows by what they are. */
export const SCENE = 'scene';

/** The scene's own lights, a group of their own; each by its id. */
export const SCENE_LIGHTS = 'scene-lights';

export const sceneLightKey = (id: LightId) => `scene-light/${id}`;

export const SKY = 'sky';

export const bodyKey = (path: BodyPath) => `body:${pathKey(path)}`;

/** An overlay it wears, by id: its row among its Overlays. */
export const overlayKey = (path: BodyPath, id: string) => `${bodyKey(path)}/overlay/${id}`;

/** One of its variants, by id: its row among its Variants. */
export const variantRowKey = (path: BodyPath, id: string) => `${bodyKey(path)}/variant/${id}`;

/** Its categories: its shapes, the overlays it wears, its variants, its moons (its lights: `lightsKey`). */
export const shapesKey = (path: BodyPath) => `${bodyKey(path)}/shapes`;
export const overlaysKey = (path: BodyPath) => `${bodyKey(path)}/overlays`;
export const variantsKey = (path: BodyPath) => `${bodyKey(path)}/variants`;
export const moonsKey = (path: BodyPath) => `${bodyKey(path)}/moons`;

/** A material of its own, or of an overlay it wears (by the overlay's id: two may share one). */
export const materialRowKey = (path: BodyPath, name: string, overlay?: string) =>
  overlay ? `${bodyKey(path)}/om/${overlay}/${name}` : `${bodyKey(path)}/m/${name}`;

export const partRowKey = (path: BodyPath, key: PartKey) => `${bodyKey(path)}/p/${key}`;

/** The room a body's glow is given where the view is fitted to it (as set, else under it). */
export const glowMarginOf = (b: BodyInfo) => stackedSetting(b, 'glowMargin');

/** A group put in the scene, by its index there. */
export const placementKey = (key: string) => `place/${key}`;

/** The scene's cameras, a group of their own; each by its id (the game's: `GAME_CAMERA`). */
export const CAMERAS = 'cameras';

export const cameraKey = (id: string) => `camera/${id}`;

/** The editor's own camera, as what the view looks through (not one of the scene's). */
export const EDITOR_CAMERA = 'editor';

/** A body of a group put in the scene (by the index of its planet among them all, and its moon path): not a row. */
export const groupBodyKey = (planet: number, moon: BodyPath) => `gbody:${planet}/${pathKey(moon)}`;

/** Planets in words: their ids, or that there are none. */
export const planetsIn = (bodies: readonly SceneBody[]) =>
  bodies.length ? bodies.map((b) => b.id).join(', ') : 'No planets yet';

/** Its lights (its rig's and its shadow), a group of their own. */
export const lightsKey = (path: BodyPath) => `${bodyKey(path)}/lights`;

export const lightRowKey = (path: BodyPath, id: LightId) => `${bodyKey(path)}/l/${id}`;

export const skyMaterialKey = (name: string) => `${SKY}/m/${name}`;

/** An overlay the sky wears, by id: its parts (with their materials) under it. */
export const skyOverlayKey = (id: string) => `${SKY}/overlay/${id}`;

export const skyPartKey = (key: PartKey) => `${SKY}/p/${key}`;

/** A material of an overlay the sky wears (two may share one). */
export const skyOverlayMaterialKey = (overlay: string, name: string) =>
  `${SKY}/om/${overlay}/${name}`;

/**
 * The sky's materials at a depth (background, midground, foreground), a group of their own: open
 * unless folded (its key among those kept unfolded means folded, so it starts open).
 */
export const skyDepthKey = (depth: string) => `${SKY}/depth/${depth}`;

/** What a scene tree row's key is. */
export type Target =
  | { readonly kind: 'scene' }
  | { readonly kind: 'sky' }
  | {
      readonly kind: 'sky-material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly name: string;
      /** The overlay the sky wears it is of, where it is one's (else the sky's own). */
      readonly overlay?: string;
      readonly view?: MaterialView;
    }
  /** A part of an overlay the sky wears. */
  | { readonly kind: 'sky-part'; readonly key: PartKey }
  | { readonly kind: 'body'; readonly path: BodyPath }
  /** A group of rows: the scene's lights, the sky's depths, an overlay the sky wears. */
  | {
      readonly kind: 'group';
      readonly path: BodyPath;
      /** An overlay the sky wears (its id). */
      readonly skyOverlay?: string;
    }
  /** An overlay a body wears, by id. */
  | { readonly kind: 'overlay'; readonly path: BodyPath; readonly id: string }
  /** One of a body's categories (what adds to it, and what is in it), and one of its variants by id. */
  | { readonly kind: BodyCategory; readonly path: BodyPath }
  | { readonly kind: 'variant'; readonly path: BodyPath; readonly id: string }
  | {
      readonly kind: 'material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly path: BodyPath;
      readonly name: string;
      /** The overlay it is of, where it is one's (else the body's own). */
      readonly overlay?: string;
      /** What of it the row shows, where not the material itself. */
      readonly view?: MaterialView;
    }
  | { readonly kind: 'part'; readonly path: BodyPath; readonly key: PartKey }
  | { readonly kind: 'light'; readonly path: BodyPath; readonly id: LightId }
  /** One of the scene's own lights. */
  | { readonly kind: 'scene-light'; readonly id: LightId }
  /** The reference image laid over the view (an editing aid). */
  | { readonly kind: 'reference' }
  /** A group put in the scene, by its index there. */
  | { readonly kind: 'placement'; readonly key: string }
  /** The scene's cameras (their group), and one of them by id. */
  | { readonly kind: 'cameras' }
  | { readonly kind: 'camera'; readonly id: string };

/** Whether a target is a body itself or one of its categories: what is added there goes onto the body. */
export const atBody = (t: Target): t is Extract<Target, { readonly kind: 'body' | BodyCategory }> =>
  t.kind === 'body' || (BODY_CATEGORIES as readonly string[]).includes(t.kind);

/** What of a body a target is, as a light reaches it: the body (none), a part or a material; not one (undefined). */
export function receiverOf(t: Target): Receiver | null | undefined {
  if (t.kind === 'body') return null;
  if (t.kind === 'part') return `part:${t.key}`;
  if (t.kind === 'material') return `material:${t.key}`;
  return undefined;
}

export function targetOf(key: string): Target {
  // What of a material a row shows (a layer, its shader, an effect), or a shader's group.
  const split = splitViewKey(key);
  if (split) {
    const t = targetOf(split.base);
    if (split.view === 'group') return { kind: 'group', path: 'path' in t ? t.path : [] };
    return t.kind === 'material' || t.kind === 'sky-material' ? { ...t, view: split.view } : t;
  }
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key.startsWith(`${SKY}/m/`)) {
    const name = key.slice(SKY.length + 3);
    return { kind: 'sky-material', name, key: name };
  }
  if (key.startsWith(`${SKY}/om/`)) {
    const [overlay = '', ...rest] = key.slice(SKY.length + 4).split('/');
    const name = rest.join('/');
    return { kind: 'sky-material', name, key: materialKey(name, overlay), overlay };
  }
  if (key.startsWith(`${SKY}/overlay/`))
    return { kind: 'group', path: [], skyOverlay: key.slice(SKY.length + 9) };
  if (key.startsWith(`${SKY}/p/`))
    return { kind: 'sky-part', key: key.slice(SKY.length + 3) as PartKey };
  if (key.startsWith(`${SKY}/depth/`)) return { kind: 'group', path: [] };
  if (key === SKY) return { kind: 'sky' };
  if (key === SCENE_LIGHTS) return { kind: 'group', path: [] };
  if (key.startsWith('scene-light/'))
    return { kind: 'scene-light', id: key.slice('scene-light/'.length) as LightId };
  if (key.startsWith('place/')) return { kind: 'placement', key: key.slice(6) };
  if (key === CAMERAS) return { kind: 'cameras' };
  if (key.startsWith('camera/')) return { kind: 'camera', id: key.slice('camera/'.length) };
  if (!key.startsWith('body:')) return { kind: 'scene' };
  const rest = key.slice(5);
  const slash = rest.indexOf('/');
  const path = pathOf(slash < 0 ? rest : rest.slice(0, slash));
  const tail = slash < 0 ? '' : rest.slice(slash);
  if (tail.startsWith('/overlay/')) return { kind: 'overlay', path, id: tail.slice(9) };
  if (tail.startsWith('/variant/')) return { kind: 'variant', path, id: tail.slice(9) };
  const category = BODY_CATEGORIES.find((c) => tail === `/${c}`);
  if (category) return { kind: category, path };
  if (tail.startsWith('/l/')) return { kind: 'light', path, id: tail.slice(3) as LightId };
  if (tail.startsWith('/m/')) {
    const name = offPart(tail.slice(3));
    return { kind: 'material', path, name, key: name };
  }
  if (tail.startsWith('/om/')) {
    const [overlay = '', ...rest] = tail.slice(4).split('/');
    const name = offPart(rest.join('/'));
    return { kind: 'material', path, name, key: materialKey(name, overlay), overlay };
  }
  if (tail.startsWith('/p/')) return { kind: 'part', path, key: tail.slice(3) as PartKey };
  return { kind: 'body', path };
}

/** A body as set, without its moons (each of them is compared on its own). */
export const ownPart = (b: SceneBody | MoonChoices | undefined) => b && { ...b, moons: undefined };

export interface SceneEditorState {
  /** The scene, by id (the URL's); '': the random sets'. */
  readonly scene: string;
  /** The selected row's key. */
  readonly selected: string;
  /** The moon the view is centred on, by its path's key; none: the whole scene. */
  readonly focus: string | null;
  /** What the view looks through: the editor's own camera (`EDITOR_CAMERA`), or one of the scene's by id. */
  readonly look: string;
  /** Where the editor's own camera is, over the scene's primary (none: there); not kept. */
  readonly editorCamera: SceneCameraSet | null;
  /**
   * The scene's own variant edited: switching a planet's variants then goes into it (see
   * `sceneVariantOpen`); none: into the scene's settings for the planet.
   */
  readonly sceneVariantEdited: string | null;
  /** The scene just shown before its planets were there: its first planet is unfolded as they come. */
  readonly opening: boolean;
  /**
   * What the editor is inside (editing in place): a planet's or moon's row key, or an overlay's a
   * body wears; none: the whole scene. Its edits still land on the scene's copy.
   */
  readonly inside: string | null;
}

/** One of a scene's cameras: its id, its name, where it puts the view (over the game's), whether it is the game's. */
export interface CameraEntry {
  readonly id: string;
  readonly name: string;
  readonly set: SceneCameraSet;
  readonly game: boolean;
  /** How its place is set (none: in the scene's own space). */
  readonly placement?: CameraPlacement;
}
