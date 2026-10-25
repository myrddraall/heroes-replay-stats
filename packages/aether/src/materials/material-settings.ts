import type { SceneBlend, SceneMaterial } from '../formats/play-scene';
import { rimTurn, TOWARDS_EYE, type Vec3 } from '../space/directions';
import {
  type AddedLight,
  addedLight,
  placedLight,
  SHIELD_DEFAULTS,
  type ShieldEffect,
} from '../lights/lights';
import type {
  GridLight,
  LayerSlot,
  MaterialDepth,
  MaterialDrawAs,
  MaterialSettings,
  MaterialSettingsMap,
  MaterialTint,
  SkyAnchor,
} from '../formats/planets';
import { anchoredDepth, skyAnchorOf } from '../sky/sky-anchors';
import { DEFAULT_ORIENTATION, type Orientation } from '../space/graph';

/**
 * Materials' settings as the renderer and the Background page's panel read them: what a
 * material's settings come to from the layers that set them, what its controls show where
 * nothing is set, and which of its controls do anything.
 */

/** The blends a material may be given. */
export const MATERIAL_BLENDS: readonly SceneBlend[] = ['opaque', 'alpha', 'add', 'alphaAdd'];

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
      reach: light.wrap ?? 0,
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

/** Which of a material's controls do anything, by what it has. */
export interface MaterialControls {
  /** A blended material's alpha scales; an opaque one's doesn't. */
  readonly strength: boolean;
  /** A layer with a fresnel has a floor to set, and a side it spreads from. */
  readonly spread: boolean;
  /** A grid (a drawn pattern) has an inactive and an active colour. */
  readonly colours: boolean;
  /** An emissive layer has a pattern to size. */
  readonly scale: boolean;
  /** A drawn pattern can be shown as its texture instead (the game's way). */
  readonly drawAs: boolean;
  /** A textured emissive has a range to cut; a drawn pattern's lines are set instead. */
  readonly cut: boolean;
  /** A drawn pattern's lines have a width and a softness. */
  readonly lines: boolean;
  /** Drawn by a particle system: only whether it is drawn, its strength and its depth apply. */
  readonly particles: boolean;
  /** A sky material is drawn behind the scene's objects, among them or in front of them. */
  readonly depth: boolean;
  /** A sky material is anchored against the camera. */
  readonly anchor: boolean;
  /** A body's material is lit by its light or flat (the sky and particles aren't lit). */
  readonly lit: boolean;
  /** A body's material with a specular layer shines where its lights' specular says. */
  readonly specular: boolean;
  /** A body's material is turned facing the camera or fixed in the world (the sky and particles aren't). */
  readonly orientation: boolean;
}

/** What a material is used as, for which of its controls do anything. */
export interface MaterialUseOf {
  /** Its part has a pattern drawn for its emissive. */
  readonly pattern?: boolean;
  /** A particle system draws it. */
  readonly particles?: boolean;
  /** How its pattern shows (drawn unless set). */
  readonly drawAs?: MaterialDrawAs;
  /** It is the sky's. */
  readonly sky?: boolean;
}

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
    inactive: settings?.inactive ?? ownInactive(material),
    active: settings?.active ?? DEFAULT_ACTIVE,
    gridLights: gridLightsOf(settings),
    orientation: settings?.orientation ?? DEFAULT_ORIENTATION,
  };
}

/**
 * Which of a material's controls do anything: by its layers, and what it is used as (whether a
 * pattern is drawn for its emissive, and whether it is shown so or as its texture; whether a
 * particle system draws it; whether it is the sky's).
 */
export function materialControls(
  material: SceneMaterial,
  use: MaterialUseOf = {},
): MaterialControls {
  const { pattern = false, particles = false, drawAs = 'pattern', sky = false } = use;
  if (particles)
    return {
      strength: true,
      spread: false,
      colours: false,
      scale: false,
      drawAs: false,
      cut: false,
      lines: false,
      particles,
      depth: sky,
      anchor: sky,
      lit: false,
      specular: false,
      orientation: false,
    };
  const layers = [material.diffuse, material.emissive, ...material.alphaMasks];
  const drawn = pattern && drawAs === 'pattern';
  return {
    particles,
    strength: material.blend !== 'opaque',
    // (A grid's rim is one of its lights: no Rim section of its own.)
    spread: layers.some((l) => l?.fresnel !== undefined) && !pattern,
    colours: pattern,
    scale: material.emissive !== null || pattern,
    drawAs: pattern && material.emissive?.texture !== undefined,
    cut: material.emissive !== null && !drawn,
    lines: drawn,
    depth: sky,
    anchor: sky,
    // (A grid is an unlit energy field: its own lights say where it shows.)
    lit: !sky && !pattern,
    specular: !sky && !pattern && material.specular !== undefined,
    orientation: !sky,
  };
}

/** Where each of a thing's settings comes from: the name of the level that sets it, where one does. */
export type SettingOrigins<K extends string> = Partial<Record<K, string>>;

/**
 * Which level sets each setting, from levels in order (the later over the earlier, as they
 * merge): its name, for the last level that sets it.
 */
export function originsOf<K extends string>(
  levels: readonly (readonly [string, Partial<Record<K, unknown>> | undefined])[],
): SettingOrigins<K> {
  const out: Partial<Record<K, string>> = {};
  for (const [name, values] of levels)
    if (values)
      for (const [key, value] of Object.entries(values) as [K, unknown][])
        if (value !== undefined) out[key] = name;
  return out;
}
