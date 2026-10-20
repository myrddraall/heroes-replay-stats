import type { BuiltInPlanet } from '../../../scenes/play-background/built-in-planets';
import type { SceneLayer, SceneMaterial } from '../../../scenes/play-background/play-scene';
import type {
  BodyPart,
  PartMapping,
  PlanetFile,
  PlanetLight,
} from '../../../scenes/play-background/scene-planets';
import { GRID_COLOURS, STAND_IN_LIGHT_FROM, type StandInFill } from './editing-aids.store';

/**
 * The stand-in planet: a plain sphere an asset is shown on while it is edited (a material opened
 * on its own), a plain colour (its material tinted) or a transparency grid, lit by a plain key
 * light (turned, and with light from all round added, by the stage). Made by the app (an editing
 * aid), never exported or published.
 */
export const STAND_IN = '@stand-in';
/** Its own material: tinted to the colour chosen. */
export const STAND_IN_MATERIAL = 'stand-in';
const GRID_TEXTURE = 'stand-in-grid';

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
 * A plain directional light from the upper left, in front, and no ambient: the stage adds light
 * from all round, and switches the directional light on (turned, as strong as asked) or off, as the editing aids say (by
 * default all round only: even).
 */
const LIGHT: PlanetLight = {
  ambient: [0, 0, 0],
  directional: [
    {
      direction: [-STAND_IN_LIGHT_FROM[0], -STAND_IN_LIGHT_FROM[1], -STAND_IN_LIGHT_FROM[2]],
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
