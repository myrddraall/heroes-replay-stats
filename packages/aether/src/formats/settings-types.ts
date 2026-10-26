import type { SceneBlend, SceneLayer, SceneMaterial, SkyOverlayFile } from './play-scene';
import type { TintBlend } from '../tints/tints';
import type { AddedLight, LightKind } from '../lights/lights';
import type { AddedPart } from '../design/overlays/created-overlays';
import type { Orientation } from '../space/graph';
import type { PartKey } from './part-keys';
import type { Vec3 } from './part-shapes';

/**
 * A part's shape and how its textures lie on it, in place of its own (each where set), relative to
 * its body (so a style's part fits any planet it is worn by): its size (times its own: a sphere's
 * radius, a ring's radii); a sphere's textures turned about its pole (`turn`, degrees) and its pole
 * tilted (`tilt`, degrees, its top towards the eye); a ring's width (times its own, about its middle
 * circle), its plane's depth along the line of sight (body radii; negative: towards the eye), the
 * circle across it its texture is brightest on (`mid`, 0 its inner edge to 1 its outer), and
 * whether it keeps to its body's limb seen from wherever its body is (`keepToLimb`, where it was
 * modelled to).
 */
export interface PartSettings {
  /** Its name as shown, in place of its role's (Surface, Shield, Ring…). */
  readonly label?: string;
  /** Whether it is drawn (its materials with it). */
  readonly enabled?: boolean;
  readonly size?: number;
  readonly turn?: number;
  readonly tilt?: number;
  readonly width?: number;
  /** A sky's band's height, times its own, about its middle (up and down); a tube's or a cone's length, times its own. */
  readonly height?: number;
  /** A tube's or a cone's side: its outside (`near`) or its inside (`far`), in place of its own. */
  readonly side?: 'near' | 'far';
  readonly depth?: number;
  readonly mid?: number;
  readonly keepToLimb?: boolean;
  /** A sphere's textures round it the other way (mirrored), in place of its own way. */
  readonly flip?: boolean;
  /** A ring's texture turned round it: where it is greatest (degrees round its plane), in place of its own. */
  readonly from?: number;
  /** How many times a ring's texture goes round it (its u at its greatest), in place of its own. */
  readonly repeat?: number;
  /** Which way it is turned, over its body's (see `Orientation`): its materials' unless they set their own. */
  readonly orientation?: Orientation;
}

/** Parts' settings by part. */
export type PartSettingsMap = Readonly<Partial<Record<PartKey, PartSettings>>>;

/** Parts' settings from several levels, the later over the earlier, each setting its own. */
export function mergePartSettings(
  ...levels: readonly (PartSettingsMap | undefined)[]
): PartSettingsMap {
  const out: Partial<Record<PartKey, PartSettings>> = {};
  for (const level of levels)
    for (const [key, settings] of Object.entries(level ?? {}) as [PartKey, PartSettings][])
      out[key] = { ...out[key], ...settings };
  return out;
}

/**
 * A grid's (the shield's) light as it was kept before the shield's lights were the body's kind
 * of light (`AddedLight`, with a `shield` effect): read as one (`gridLightsOf`), never written.
 * From all round or a side, as strong as `strength`, reaching round the face (`reach`, its wrap
 * now) as softly as `softness`; revealing, activating (energizing, glowing), or darkening.
 */
export interface GridLight {
  readonly id: `grid-${string}`;
  readonly name: string;
  readonly kind: LightKind;
  readonly enabled?: boolean;
  readonly darkens?: boolean;
  readonly strength?: number;
  readonly from?: Vec3;
  readonly softness?: number;
  readonly reach?: number;
  readonly reveals?: boolean;
  readonly activates?: boolean;
  readonly energizes?: number;
  readonly glow?: number;
}

/**
 * How a material shows, where something says (a planet's tuning, a style's, a placement): the
 * data's way otherwise. The same settings for any material, a planet's, a style's or the sky's;
 * each does nothing where the material has nothing for it to act on (a strength on an opaque
 * material, a scale without an emissive layer).
 */
export interface MaterialSettings {
  /** Its name as shown, in place of the one made from the data's (its data name stays its key). */
  readonly label?: string;
  /** Whether it is drawn at all. */
  readonly enabled?: boolean;
  /** How strongly it shows, 0 to 1 (1: as the data has it): a blended material's alpha times this. */
  readonly strength?: number;
  /** How it blends over what is behind it, in place of the data's. */
  readonly blend?: SceneBlend;
  /** Its glow: 0 none, 1 its own light's bloom as the data has it, past 1 its emissive light boosted into the bloom. */
  readonly glow?: number;
  /**
   * A grid's colours (`#rrggbb`): inactive (its own, the data's) where it isn't activated, active
   * where it is fully, blended between.
   */
  readonly inactive?: string;
  readonly active?: string;
  /**
   * A grid's (the shield's) lights, its own: lights like a body's (each with a `shield` effect:
   * where the grid shows and where it is active). Set as a whole, a level's list in place of the
   * one under it; those kept from before (`GridLight`) are read as lights.
   */
  readonly gridLights?: readonly (AddedLight | GridLight)[];
  /**
   * A grid's reveal and activation of before its lights were its own (read as its lights where
   * none are set: `gridLightsOf`): its reveal from `revealFrom`, reaching round the face
   * (`revealReach`), falling off (`revealFalloff`), as strong as `revealStrength`, unless
   * `revealOn` is false; its activation (once `activationOn`) shaped so, from the reveal's side
   * while `activationTied`, energizing (`activationEnergizes`) and glowing (`activationGlow`).
   */
  readonly revealOn?: boolean;
  readonly revealStrength?: number;
  readonly revealFrom?: Vec3;
  readonly revealReach?: number;
  readonly revealFalloff?: number;
  /**
   * A grid's activation: its colour from inactive to active, shaped as its reveal is (off unless
   * `activationOn`); its side the reveal's while `activationTied` (unless false); revealing what
   * it activates too (`activationEnergizes` times as much), and shining brighter and blooming
   * more there (`activationGlow`).
   */
  readonly activationOn?: boolean;
  readonly activationStrength?: number;
  readonly activationTied?: boolean;
  readonly activationFrom?: Vec3;
  readonly activationReach?: number;
  readonly activationFalloff?: number;
  readonly activationEnergizes?: number;
  readonly activationGlow?: number;
  /** How far it shows away from the limb, 0 to 1: a floor under its layers' fresnel (unset: each layer's own). */
  readonly spread?: number;
  /**
   * A lit material's shine where it has a specular layer: how strong (its specular multiplier, in
   * place of the data's), and how glossy (the highlight's power: higher, tighter; in place of its
   * specularity).
   */
  readonly specular?: number;
  readonly glossiness?: number;
  /**
   * The side it spreads from: the point on its face (body frame) its layers' fresnel is brightest
   * on, as a light comes from one (unset: each layer's own turn).
   */
  readonly spreadFrom?: Vec3;
  /** Which way a body's material is turned (each its own draw), over its part's and its body's (see `Orientation`). */
  readonly orientation?: Orientation;
  /**
   * How sharply its layers' fresnel (the kind strongest edge-on) rises toward the edge: the
   * formula to this power (2, as measured on the Play screen planets' grid, unless set).
   */
  readonly falloff?: number;
  /**
   * How large its emissive pattern is, drawn or textured alike (2: twice the size): a texture's
   * tiling over this, a drawn pattern's cells round the part over this.
   */
  readonly scale?: number;
  /**
   * How a part with a drawn pattern shows it: drawn (`pattern`, the default) or as the game does,
   * its emissive texture (`texture`), to compare the two.
   */
  readonly drawAs?: MaterialDrawAs;
  /**
   * The textures its alpha masks read, in place of its own, in order (by name: a texture of a
   * planet it is drawn on, so loaded with it): a body wearing a style its own mask on its parts.
   */
  readonly masks?: readonly string[];
  /** How much of its emissive pattern is cut to black, 0 to 1: a grid's cells go, its lines stay. */
  readonly cut?: number;
  /** How wide its drawn pattern's lines are, as a share of a cell (0 to 0.5). */
  readonly width?: number;
  /** How softly its drawn pattern's lines glow about themselves, 0 to 1. */
  readonly soft?: number;
  /** A colour blended over it. */
  readonly tint?: MaterialTint;
  /**
   * Where it is drawn among the scene's objects (a sky material's say): behind them all, as if
   * infinitely far (`background`, the sky's default), among them at its own depth (`scene`), or in
   * front of them all, as if at the camera (`foreground`).
   */
  readonly depth?: MaterialDepth;
  /**
   * How it is anchored against the camera (a sky material's say), over the sky's own anchor (see
   * `SkyAnchor`); unset: as the sky is.
   */
  readonly anchor?: SkyAnchor;
  /**
   * Whether its body's light lights it (`true`), or it shows as its textures have it, flat (a
   * painting with its light painted in); unset: as the data has it (`unshaded`). A lit one on a
   * body with no light shows flat.
   */
  readonly lit?: boolean;
  /** Its layers' textures and how they lie on it, each layer's where set (by its slot). */
  readonly layers?: Partial<Record<LayerSlot, LayerSettings>>;
}

/** A material's layers by where they are in it: its diffuse, its emissive, its first and second alpha mask. */
export type LayerSlot = 'diffuse' | 'emissive' | 'mask1' | 'mask2';

/**
 * A layer's texture and how it lies on its material, in place of the data's (each where set): its
 * texture (by key: one loaded with what it is drawn on, else its own is kept), how far it is moved
 * (`offset`, in the texture's own widths), turned (`rotation`, degrees about its middle), repeated
 * (`tiling`, times across u and v), scrolled (`scroll`, texture widths a second; [0, 0] still) and
 * whether it repeats or stops at its edges (`wrap`, across u and across v).
 */
export interface LayerSettings {
  /** Its name as shown, in place of its slot's (Diffuse, Emissive, Mask). */
  readonly label?: string;
  readonly texture?: string;
  readonly offset?: readonly [number, number];
  readonly rotation?: number;
  readonly tiling?: readonly [number, number];
  readonly scroll?: readonly [number, number];
  readonly wrap?: readonly [boolean, boolean];
}

/** A material's layers that are there, by slot, in order. */
export function layerSlots(material: SceneMaterial): [LayerSlot, SceneLayer][] {
  const out: [LayerSlot, SceneLayer][] = [];
  if (material.diffuse) out.push(['diffuse', material.diffuse]);
  if (material.emissive) out.push(['emissive', material.emissive]);
  material.alphaMasks.slice(0, 2).forEach((m, i) => out.push([i ? 'mask2' : 'mask1', m]));
  return out;
}

/** A layer with its settings applied (a texture `loaded` doesn't have: its own kept). */
export function withLayer(
  layer: SceneLayer,
  settings: LayerSettings | undefined,
  loaded: (texture: string) => boolean = () => true,
): SceneLayer {
  if (!settings) return layer;
  const { texture, offset, rotation, tiling, scroll, wrap } = settings;
  return {
    ...layer,
    ...(texture && loaded(texture) ? { texture } : {}),
    ...(offset ? { offset } : {}),
    ...(rotation !== undefined ? { angle: (rotation * Math.PI) / 180 } : {}),
    ...(tiling ? { tiling } : {}),
    ...(wrap ? { wrap } : {}),
    ...(scroll
      ? {
          scroll: scroll[0] || scroll[1] ? { seconds: 1, by: scroll, endless: true } : undefined,
        }
      : {}),
  };
}

/** A material with its layers' settings applied, by slot (see `withLayer`). */
export function withLayers(
  material: SceneMaterial,
  layers: MaterialSettings['layers'],
  loaded?: (texture: string) => boolean,
): SceneMaterial {
  if (!layers) return material;
  const at = (slot: LayerSlot, layer: SceneLayer | null) =>
    layer ? withLayer(layer, layers[slot], loaded) : layer;
  return {
    ...material,
    diffuse: at('diffuse', material.diffuse),
    emissive: at('emissive', material.emissive),
    alphaMasks: material.alphaMasks.map((m, i) =>
      i < 2 ? withLayer(m, layers[i ? 'mask2' : 'mask1'], loaded) : m,
    ),
  };
}

/**
 * A colour blended over a material's own, as CSS's blend modes of those names do, by `strength`
 * (0: not at all, 1: all the way); a colour past white keeps its brightness.
 */
export interface MaterialTint {
  /** `#rrggbb`. */
  readonly colour: string;
  readonly blend: TintBlend;
  readonly strength: number;
}

/** Where a material is drawn among the scene's objects: behind them, among them or in front. */
export type MaterialDepth = 'background' | 'scene' | 'foreground';

/**
 * How the sky is anchored against the camera that sees it: fixed in the world (`world`: moving or
 * turning the camera shows it from elsewhere, nearer or past its edges), moved with the camera's
 * place but keeping its directions in the world (`position`: as a skybox, looking round shows
 * other parts of it, but it never comes nearer), or moved and turned with the camera (`camera`: a
 * fixed backdrop, always as the scene's own camera sees it). Seen from the scene's own camera, all
 * three look the same.
 */
export type SkyAnchor = 'world' | 'position' | 'camera';

/** How a material with a drawn pattern shows it: drawn, or as its texture (the game's way). */
export type MaterialDrawAs = 'pattern' | 'texture';

/** Materials' settings by the materials' names. */
export type MaterialSettingsMap = Readonly<Record<string, MaterialSettings>>;

/**
 * How the sky shows: its materials' settings by key (`materialKey`), a tint over all of it
 * (its stars too), and the overlays it wears.
 */
export interface SkySettings {
  /** Its materials' settings: its own by name (over their base settings), its overlays' by `materialKey`. */
  readonly materials?: MaterialSettingsMap;
  /** The materials' base settings, by name (under its overlays' materials' own). */
  readonly base?: MaterialSettingsMap;
  readonly tint?: MaterialTint;
  /** How it is anchored against the camera, where its materials don't say otherwise (unset: `world`). */
  readonly anchor?: SkyAnchor;
  /** Its materials' draw order, by `materialKey` (the later over the earlier; see `drawOrder`), where set. */
  readonly order?: readonly string[];
  /** The overlays it wears and draws, in order, by id (none given: its data's). */
  readonly overlays?: readonly string[];
  /** Its overlays' parts' settings, by part (`style:<overlay>:<part>`). */
  readonly parts?: PartSettingsMap;
  /** Its own parts (added onto it): their file, and the images their textures are. */
  readonly own?: {
    readonly file: SkyOverlayFile;
    readonly images: Readonly<Record<string, ImageBitmap>>;
  };
  /** The parts added onto it, under those built (`own`): as the design has them. */
  readonly addedParts?: readonly AddedPart[];
  /** Overlays made in the editor it wears, by id: their files, and the images their textures are. */
  readonly made?: Readonly<
    Record<
      string,
      { readonly file: SkyOverlayFile; readonly images: Readonly<Record<string, ImageBitmap>> }
    >
  >;
}
