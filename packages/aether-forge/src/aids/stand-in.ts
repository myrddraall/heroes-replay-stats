import { type BodyPart, type BuiltInPlanet, DEFAULT_SHADE, type PartMapping, type PlanetFile, type PlanetLight, type SceneLayer, type SceneMaterial } from "@myrddraall/heroes-replay-stats-aether/formats";
import { bodyLights, type LightId, type LightSettings, type LightSettingsMap, mergeLightSettings } from "@myrddraall/heroes-replay-stats-aether/lights";
import type { LightEntry } from '../editing/editor-model';
import { GRID_COLOURS, type StandInFill } from './editing-aids.store';

/**
 * The stand-in planet: a plain sphere an asset is shown on while it is edited (a material opened
 * on its own), a plain colour (its material tinted) or a transparency grid, lit by lights of its
 * own (an ambient light, and a directional light switched on where asked: see `standInLights`).
 * Made by the app (an editing aid), never exported or published.
 */
export const STAND_IN = '@stand-in';
/** Its own material: tinted to the colour chosen. */
export const STAND_IN_MATERIAL = 'stand-in';
const GRID_TEXTURE = 'stand-in-grid';
/** Where its directional light comes from unless turned: upper left, in front (its frame: x right, y away, z up). */
const LIGHT_FROM: readonly [number, number, number] = [-0.55, -0.45, 0.7];

/** A stand-in: its fill, its grid's squares round its equator, and a material over it from where it is used. */
export interface StandInSpec {
  readonly fill: StandInFill;
  readonly cells: number;
  /** The file (a planet's id, or `style-<id>`) the material is drawn from. */
  readonly owner?: string;
  readonly material?: string;
}

export const standInId = (s: StandInSpec) =>
  [STAND_IN, s.fill, s.cells, s.owner ?? '', s.material ?? ''].join(':');

export function parseStandIn(id: string): StandInSpec | null {
  const [head, fill, cells, owner, material] = id.split(':');
  if (head !== STAND_IN || (fill !== 'colour' && fill !== 'grid')) return null;
  return {
    fill,
    cells: Number(cells) || 32,
    owner: owner || undefined,
    material: material || undefined,
  };
}

/** A uv sphere about z: u round it, v from pole to pole. */
const MAPPING: PartMapping = {
  kind: 'sphere',
  pole: [0, 0, 1],
  meridian: [0, 1, 0],
  flip: false,
  u0: 0,
  v: Array.from({ length: 32 }, (_, i) => i / 31),
};

/**
 * Its light rig: white light from all round (at 1, as the scene's exposure is, a surface as bright
 * as its textures), and a white directional light from the upper left, in front.
 */
const LIGHT: PlanetLight = {
  ambient: [1, 1, 1],
  directional: [
    {
      direction: [-LIGHT_FROM[0], -LIGHT_FROM[1], -LIGHT_FROM[2]],
      color: [1, 1, 1],
    },
  ],
  exposure: 1,
};

const plainMaterial = (diffuse: SceneLayer): SceneMaterial => ({
  blend: 'opaque',
  unshaded: false,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse,
  emissive: null,
  alphaMasks: [],
});

/** The grid's texture: two squares of each colour, tiled round the sphere. */
async function gridImage(): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(64, 64);
  const g = canvas.getContext('2d')!;
  g.fillStyle = GRID_COLOURS[0];
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = GRID_COLOURS[1];
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  return createImageBitmap(canvas);
}

/** The textures a material's layers read. */
const texturesOf = (m: SceneMaterial) =>
  [m.diffuse, m.emissive, ...m.alphaMasks].flatMap((l) => (l?.texture ? [l.texture] : []));

/**
 * A stand-in's file: its sphere, and the material it shows drawn over it on the parts of its own
 * file that draw it (their shapes, mappings and patterns), so it lies on the sphere as it does on
 * its planet. Undefined where the material's file isn't loaded.
 */
export function buildStandIn(
  spec: StandInSpec,
  files: Readonly<Record<string, PlanetFile>>,
): BuiltInPlanet | undefined {
  const grid = spec.fill === 'grid';
  const surface: BodyPart = {
    role: 'surface',
    shape: { kind: 'sphere', radius: 1, side: 'near' },
    mapping: MAPPING,
    materials: [STAND_IN_MATERIAL],
  };
  const own = plainMaterial(
    grid
      ? {
          texture: GRID_TEXTURE,
          channel: 'rgb',
          brightMult: 1,
          tiling: [spec.cells / 2, spec.cells / 4],
          wrap: [true, true],
        }
      : { color: [255, 255, 255, 255], brightMult: 1 },
  );
  let parts: BodyPart[] = [surface];
  let materials: Record<string, SceneMaterial> = { [STAND_IN_MATERIAL]: own };
  let textures: PlanetFile['textures'] = grid
    ? { [GRID_TEXTURE]: { file: '', width: 64, height: 64 } }
    : {};
  let tuning: PlanetFile['tuning'];
  if (spec.owner && spec.material) {
    const owner = files[spec.owner];
    const material = owner?.materials[spec.material];
    if (!owner || !material) return undefined;
    const name = spec.material;
    parts = [
      surface,
      ...owner.parts
        .filter((p) => p.materials.includes(name))
        .map((p) => ({
          ...p,
          role: p.role === 'surface' ? ('layer' as const) : p.role,
          // Over the stand-in's own surface, not level with it.
          shape:
            p.shape.kind === 'sphere' && p.shape.side === 'near' && p.shape.radius <= 1
              ? { ...p.shape, radius: 1.002 }
              : p.shape,
          materials: [name],
        })),
    ];
    materials = { ...materials, [name]: material };
    textures = {
      ...textures,
      ...Object.fromEntries(
        texturesOf(material).flatMap((t) => (owner.textures[t] ? [[t, owner.textures[t]]] : [])),
      ),
    };
    const set = owner.tuning?.materials?.[name];
    tuning = set ? { materials: { [name]: set } } : undefined;
  }
  return {
    label: 'Stand-in',
    planet: { kind: 'painted', parts, materials, textures, light: LIGHT, tuning },
    images: grid ? { [GRID_TEXTURE]: gridImage } : undefined,
  };
}

/** Its lights as they start: lit evenly, as a material preview is (its directional light switched off). */
const LIGHTS_AT_START: LightSettingsMap = { 'directional-0': { enabled: false } };
const LIGHT_NAMES: Partial<Record<LightId, string>> = {
  ambient: 'Ambient light',
  'directional-0': 'Directional light',
};

/** Its lights' settings in effect: those set (by the editing aids) over how they start. */
export const standInLightSettings = (set: LightSettingsMap): LightSettingsMap =>
  mergeLightSettings(LIGHTS_AT_START, set);

/**
 * What is set for its lights with one of them changed: settings put back as they start (`clear`,
 * or all of them) no longer set, nor its being switched on or off where that is as it starts.
 */
export function withStandInLight(
  set: LightSettingsMap,
  id: LightId,
  change: Partial<LightSettings>,
  clear: readonly (keyof LightSettings)[] | 'all' = [],
): LightSettingsMap {
  const next: Record<string, unknown> = clear === 'all' ? {} : { ...set[id] };
  if (clear !== 'all') for (const k of clear) delete next[k];
  Object.assign(next, change);
  if (next['enabled'] === (LIGHTS_AT_START[id]?.enabled ?? true)) delete next['enabled'];
  const rest = Object.fromEntries(Object.entries(set).filter(([k]) => k !== id));
  return Object.keys(next).length ? { ...rest, [id]: next } : rest;
}

/**
 * Its lights as the editor shows them (an editing aid's: nothing under them, reaching all of it,
 * none added or taken away): its ambient light and its directional light, as set over how they
 * start.
 */
export function standInLights(set: LightSettingsMap): LightEntry[] {
  return bodyLights(LIGHT, DEFAULT_SHADE, standInLightSettings(set))
    .filter((l) => l.id !== 'shadow')
    .map((l) => {
      const name = LIGHT_NAMES[l.id] ?? l.name;
      return {
        light: { ...l, name: set[l.id]?.name ?? name },
        nameBelow: name,
        enabledBelow: LIGHTS_AT_START[l.id]?.enabled ?? true,
        set: set[l.id],
        origins: {},
        removable: false,
        receivers: [],
        moons: false,
        canReachMoons: false,
      };
    });
}
