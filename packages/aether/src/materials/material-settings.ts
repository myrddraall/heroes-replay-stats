import type { SceneBlend, SceneLayer, SceneMaterial } from '../formats/play-scene';
import { rimTurn, TOWARDS_EYE } from '../space/directions';
import {
  type AddedLight,
  addedLight,
  type LightKind,
  placedLight,
  SHIELD_DEFAULTS,
  type ShieldEffect,
  shieldSpreadOf,
} from '../lights/lights';
import { anchoredDepth, type SkyAnchor, skyAnchorOf } from '../sky/sky-anchors';
import { DEFAULT_ORIENTATION, type Orientation } from '../space/graph';
import type { TintBlend } from '../tints/tints';
import { type Vec3 } from '../space/vectors';

/**
 * Materials' settings as the renderer and the editor's panels read them: what a material's
 * settings come to from the layers that set them, and what its controls show where
 * nothing is set.
 */

/** A material's settings as shown: every one resolved. */
export interface MaterialValues {
  readonly enabled: boolean;
  readonly strength: number;
  readonly blend: SceneBlend;
  readonly glow: number;
  readonly spread: number;
  readonly spreadFrom: Vec3;
  readonly falloff: number;
  readonly scale: number;
  readonly drawAs: MaterialDrawAs;
  readonly cut: number;
  readonly width: number;
  readonly soft: number;
  readonly tint: MaterialTint;
  /**
   * Where it is drawn among the scene's objects (a sky material's; a planet's are among them): one
   * not anchored to the world never among them (`anchoredDepth`).
   */
  readonly depth: MaterialDepth;
  /** How it is anchored against the camera (a sky material's): its own, else the sky's. */
  readonly anchor: SkyAnchor;
  /** Whether its body's light lights it (else flat, as its textures have it). */
  readonly lit: boolean;
  /** Its shine (see `MaterialSettings`): its own where not set. */
  readonly specular: number;
  readonly glossiness: number;
  /** How far it lets light on round (see `MaterialSettings`): as set, else its data's, else 0. */
  readonly wrap: number;
  /** How sharply its light falls off round it (see `MaterialSettings`): as set, else its data's, else 1. */
  readonly dropOff: number;
  /** A grid's colours: inactive (its own), and active (where it is activated). */
  readonly inactive: string;
  readonly active: string;
  /** A grid's lights (lights with a `shield` effect): as set, else those of before, else its rim alone. */
  readonly gridLights: readonly AddedLight[];
  /**
   * Which way a body's material is turned, as its own settings say (facing the camera where none
   * do); its part's and its body's under it are the editor's to add (`materialsOf`).
   */
  readonly orientation: Orientation;
}

/**
 * A grid's reveal and activation of before its lights were its own, where nothing was set:
 * revealed from the front, enough to show all of its face; activated (once switched on) the same
 * way at half the strength, its side the reveal's, energizing and glowing a little.
 */
const LEGACY_GRID = {
  revealOn: true,
  revealStrength: 2,
  revealFrom: TOWARDS_EYE,
  revealReach: 1,
  revealFalloff: 1,
  activationOn: false,
  activationStrength: 1,
  activationTied: true,
  activationFrom: TOWARDS_EYE,
  activationReach: 1,
  activationFalloff: 1,
  activationEnergizes: 0.25,
  activationGlow: 0.5,
} as const;

/** A grid light's settings where not set: it reveals, from its side, reaching all of its face. */
/**
 * A grid's rim as a light: the game's own look (its pattern layer's fresnel: brightest at the
 * limb, leaning to a side), its lean, spread and falloff the material's own unless set.
 */
export const RIM_LIGHT: AddedLight = {
  id: 'added-rim',
  kind: 'rim',
  name: 'Rim',
  colour: '#ffffff',
  strength: 1,
};

/** A grid's lights where none are set: its rim alone (as the game shows a grid). */
export const DEFAULT_GRID_LIGHTS: readonly AddedLight[] = [RIM_LIGHT];

/** Whether a grid light kept is of the kind from before the shield's lights were lights (see `GridLight`). */
const isLegacyGridLight = (l: AddedLight | GridLight): l is GridLight => l.id.startsWith('grid-');

/** A grid light of before as a light: its reach its wrap, what it did its shield effect. */
function fromGridLight(l: GridLight): AddedLight {
  const shield: ShieldEffect = {
    ...(l.reveals !== undefined ? { reveals: l.reveals } : {}),
    ...(l.activates !== undefined ? { activates: l.activates } : {}),
    ...(l.energizes !== undefined ? { energizes: l.energizes } : {}),
    ...(l.glow !== undefined ? { glow: l.glow } : {}),
  };
  return {
    id: `added-${l.id}`,
    kind: l.kind === 'ambient' ? 'ambient' : 'directional',
    name: l.name,
    colour: '#ffffff',
    strength: l.strength ?? 1,
    ...(l.enabled !== undefined ? { enabled: l.enabled } : {}),
    ...(l.darkens !== undefined ? { darkens: l.darkens } : {}),
    ...(l.from ? { from: l.from } : {}),
    ...(l.softness !== undefined ? { softness: l.softness } : {}),
    wrap: l.reach ?? 1,
    ...(Object.keys(shield).length ? { shield } : {}),
  };
}

/**
 * A grid's lights from its settings: as set (those kept from before read as lights), else its
 * reveal and activation of before (each a light, after the rim, which was the grid's look under
 * them: the activation's from the reveal's side while tied), else its rim alone.
 */
export function gridLightsOf(s: MaterialSettings | undefined): readonly AddedLight[] {
  if (s?.gridLights) return s.gridLights.map((l) => (isLegacyGridLight(l) ? fromGridLight(l) : l));
  const legacy = (Object.keys(LEGACY_GRID) as (keyof typeof LEGACY_GRID)[]).some(
    (k) => s?.[k] !== undefined,
  );
  if (!legacy) return DEFAULT_GRID_LIGHTS;
  const g = { ...LEGACY_GRID, ...s } as typeof LEGACY_GRID;
  const out: AddedLight[] = [RIM_LIGHT];
  if (g.revealOn)
    out.push({
      id: 'added-grid-reveal',
      name: 'Reveal',
      kind: 'directional',
      colour: '#ffffff',
      strength: g.revealStrength,
      from: g.revealFrom,
      wrap: g.revealReach,
      softness: g.revealFalloff,
    });
  if (g.activationOn)
    out.push({
      id: 'added-grid-activation',
      name: 'Activation',
      kind: 'directional',
      colour: '#ffffff',
      strength: g.activationStrength,
      from: g.activationTied ? g.revealFrom : g.activationFrom,
      wrap: g.activationReach,
      softness: g.activationFalloff,
      shield: {
        reveals: false,
        activates: true,
        energizes: g.activationEnergizes,
        glow: g.activationGlow,
      },
    });
  return out;
}

/**
 * A grid's reveal or activation as it is drawn: its side (none: all round, all of it alike),
 * reach, falloff and strength (one that darkens: taken away); an activation's energizing and glow.
 */
export interface GridField {
  /** The side it comes from (none: all round, or placed by its kind). */
  readonly from?: Vec3;
  /** How far round the face it wraps (0 the half facing it, 1 all round). */
  readonly reach: number;
  readonly falloff: number;
  readonly strength: number;
  readonly energizes?: number;
  readonly glow?: number;
  /** From a point, a spot, above and below, the sky round the body, or the rim (as the shaders number them); none: a side, or all round. */
  readonly kind?: 'point' | 'spot' | 'hemisphere' | 'environment' | 'rim';
  readonly position?: Vec3;
  /** A point's or spot's reach, the sky's; a rim's: how far in from the limb it spreads. */
  readonly fade?: number;
  /** A spot's aim; a rim's lean as the layer's fresnel turns (yaw, pitch, 0). */
  readonly aim?: Vec3;
  readonly cone?: number;
  readonly edge?: number;
}

/**
 * A grid's reveals and activations as drawn: its lights that are on, by what each does to it
 * (its shield effect: reveals unless set), each placed as the renderer places a body's light; a
 * rim light's lean, spread and falloff the material's own where it sets none.
 */
export function gridFields(v: MaterialValues): {
  readonly reveal: readonly GridField[];
  readonly activation: readonly GridField[];
} {
  const on = v.gridLights
    .map((l) => ({ raw: l, light: addedLight(l), shield: { ...SHIELD_DEFAULTS, ...l.shield } }))
    .filter(({ light }) => light.enabled);
  const field = ({ raw, light }: (typeof on)[number]): GridField => {
    const strength = light.darkens ? -light.strength : light.strength;
    if (light.kind === 'ambient') return { reach: 0, falloff: 1, strength };
    if (light.kind === 'rim') {
      const from = raw.from ?? v.spreadFrom;
      const [yaw, pitch] = rimTurn(from);
      // (Its spread is its `fade`, as a body's rim light has it; it wraps by nothing.)
      return {
        kind: 'rim',
        from,
        fade: raw.fade ?? v.spread,
        reach: 0,
        falloff: raw.softness ?? v.falloff,
        strength,
        aim: [-yaw, -pitch, 0],
      };
    }
    const placed = placedLight(light);
    return {
      ...(placed?.kind
        ? {
            kind: placed.kind,
            position: placed.position,
            fade: placed.fade,
            aim: placed.aim,
            cone: placed.cone,
            edge: placed.edge,
          }
        : {}),
      ...(light.from ? { from: light.from } : {}),
      reach: shieldSpreadOf(light),
      falloff: light.softness ?? 1,
      strength,
    };
  };
  return {
    reveal: on.filter(({ shield }) => shield.reveals).map(field),
    activation: on
      .filter(({ shield }) => shield.activates)
      .map((l) => ({ ...field(l), energizes: l.shield.energizes, glow: l.shield.glow })),
  };
}

/** No tint: white, not at all. */
export const NO_MATERIAL_TINT: MaterialTint = { colour: '#ffffff', blend: 'multiply', strength: 0 };
/** A grid's active colour where none is set: magenta (the game has none: its grids are only ever inactive). */
export const DEFAULT_ACTIVE = '#ff2bd6';

/** A material's own colour as a grid's inactive colour: its diffuse's flat colour (white where it has none). */
export function ownInactive(material: SceneMaterial): string {
  const c = material.diffuse?.texture ? undefined : material.diffuse?.color;
  if (!c) return '#ffffff';
  return `#${c
    .slice(0, 3)
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The settings where nothing says otherwise (the spread's is the material's own, see `ownSpread`). */
/** A material's glossiness where it has no specularity of its own (the game's usual, 20). */
export const DEFAULT_GLOSSINESS = 20;

export const MATERIAL_DEFAULTS = {
  enabled: true,
  strength: 1,
  glow: 1,
  scale: 1,
  falloff: 2,
  cut: 0,
  width: 0.08,
  soft: 0.3,
} as const;

/**
 * Materials' settings from several layers, the later over the earlier (a planet's tuning, then a
 * placement's say), each setting its own: a layer that leaves one out leaves the earlier's (a
 * material layer's settings too, one by one).
 */
export function mergeMaterialSettings(
  ...layers: readonly (MaterialSettingsMap | undefined)[]
): MaterialSettingsMap {
  const out: Record<string, MaterialSettings> = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [name, settings] of Object.entries(layer)) {
      const before = out[name];
      // Each of its layers' settings its own too: a level setting one of a layer's leaves the rest.
      const layers =
        before?.layers && settings.layers
          ? Object.fromEntries(
              [...new Set([...Object.keys(before.layers), ...Object.keys(settings.layers)])].map(
                (slot) => {
                  const k = slot as LayerSlot;
                  return [k, { ...before.layers?.[k], ...settings.layers?.[k] }];
                },
              ),
            )
          : (settings.layers ?? before?.layers);
      out[name] = { ...before, ...settings, ...(layers ? { layers } : {}) };
    }
  }
  return out;
}

/** One material's settings at levels, merged as `mergeMaterialSettings` merges them (the later over the earlier). */
export function mergeSettings(
  ...levels: readonly (MaterialSettings | undefined)[]
): MaterialSettings | undefined {
  return mergeMaterialSettings(...levels.map((s) => (s ? { m: s } : undefined)))['m'];
}

/**
 * The key a material's settings are kept by where it is drawn: its owner's own by its name; an
 * overlay's by the overlay and its name, wherever they are set (the overlay's own settings too),
 * so a body's material and an overlay's (or two overlays') that share a name are set apart. A
 * material's base settings (the library's for the material, wherever it is drawn) are by its name.
 */
export const materialKey = (name: string, overlay?: string) =>
  overlay ? `style:${overlay}:${name}` : name;

/**
 * The floor a material's fresnel layers have of their own: the highest of their minimums (a
 * layer without a fresnel has none).
 */
export function ownSpread(material: SceneMaterial): number {
  return Math.max(
    0,
    ...[material.diffuse, material.emissive, ...material.alphaMasks].map(
      (l) => l?.fresnel?.min ?? 0,
    ),
  );
}

/**
 * The side a material spreads from of its own: where its first fresnel layer is brightest, the
 * point on the face opposite where its turn leans (none turned, or none with a fresnel: straight
 * at the eye). A turn of `yaw` to the right and `pitch` upwards (negative), as `rimTurn` gives one
 * for the point it leans to.
 */
export function ownSpreadFrom(material: SceneMaterial): Vec3 {
  const f = [material.diffuse, material.emissive, ...material.alphaMasks].find(
    (l) => l?.fresnel,
  )?.fresnel;
  if (!f) return TOWARDS_EYE;
  const { yaw, pitch } = f;
  return [-Math.cos(pitch) * Math.sin(yaw), -Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch)];
}

/**
 * A material's settings as shown: what is set, over the material's own ways, over the defaults (a
 * sky material's depth its own, as `skyDepths` finds it, where given; its anchor the sky's, where
 * given).
 */
export function materialValues(
  material: SceneMaterial,
  settings: MaterialSettings | undefined,
  ownDepth: MaterialDepth = 'background',
  skyAnchor?: SkyAnchor,
): MaterialValues {
  const anchor = skyAnchorOf(settings, skyAnchor);
  return {
    enabled: settings?.enabled ?? MATERIAL_DEFAULTS.enabled,
    strength: settings?.strength ?? MATERIAL_DEFAULTS.strength,
    blend: settings?.blend ?? material.blend,
    glow: settings?.glow ?? MATERIAL_DEFAULTS.glow,
    spread: settings?.spread ?? ownSpread(material),
    spreadFrom: settings?.spreadFrom ?? ownSpreadFrom(material),
    falloff: settings?.falloff ?? MATERIAL_DEFAULTS.falloff,
    scale: settings?.scale ?? MATERIAL_DEFAULTS.scale,
    drawAs: settings?.drawAs ?? 'pattern',
    cut: settings?.cut ?? MATERIAL_DEFAULTS.cut,
    width: settings?.width ?? MATERIAL_DEFAULTS.width,
    soft: settings?.soft ?? MATERIAL_DEFAULTS.soft,
    tint: settings?.tint ?? NO_MATERIAL_TINT,
    depth: anchoredDepth(settings?.depth ?? ownDepth, anchor),
    anchor,
    lit: settings?.lit ?? !material.unshaded,
    specular: settings?.specular ?? material.specularMult ?? 0,
    glossiness: settings?.glossiness ?? material.specularity ?? DEFAULT_GLOSSINESS,
    wrap: settings?.wrap ?? material.wrap ?? 0,
    dropOff: settings?.dropOff ?? material.dropOff ?? 1,
    inactive: settings?.inactive ?? ownInactive(material),
    active: settings?.active ?? DEFAULT_ACTIVE,
    gridLights: gridLightsOf(settings),
    orientation: settings?.orientation ?? DEFAULT_ORIENTATION,
  };
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
   * How far a lit material lets light on round past where its face turns from it (0 the half
   * facing a light; 1 on round to the point facing away), every light alike: an atmosphere, or a
   * rough or soft surface, softening its edge of light and dark (wrap lighting). Unset: its
   * data's (`SceneMaterial.wrap`), else 0.
   */
  readonly wrap?: number;
  /**
   * How sharply a lit material's light falls off round it, from where a light faces it squarely to
   * where it turns away: the power its facing is raised to (1 as the game lights; higher, a harder
   * edge; lower, a softer), every light from a side, a point or a spot alike. Unset: its data's
   * (`SceneMaterial.dropOff`), else 1.
   */
  readonly dropOff?: number;
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

/** How a material with a drawn pattern shows it: drawn, or as its texture (the game's way). */
export type MaterialDrawAs = 'pattern' | 'texture';

/** Materials' settings by the materials' names. */
export type MaterialSettingsMap = Readonly<Record<string, MaterialSettings>>;
