import type { LibraryState } from '../document/design';
import { CREATED_OVERLAY, createdOverlay, overlayFile } from './overlays';
import type {
  LoadedPlayScene,
  PlayScene,
  SceneMaterial,
  SceneTexture,
  SkyOverlayFile,
  SkyPart,
} from '../../formats/play-scene';
import { BAND } from '../../sky/sky-overlays';
import type { Vec3 } from '../../space/directions';
import {
  type BodyPart,
  type LoadedPlanet,
  partId,
  type PlanetFile,
  planeMapping,
} from '../../formats/planets';
import { V_SAMPLES } from '../../render/limits';

/**
 * Parts made in the editor: an overlay's (kept in the design's library, by an id starting
 * `@overlay-`: a planet's, about the body wearing it; or the sky's, about the eye), or added
 * straight onto a body or a sky (its own, kept with its settings at the level they are added at).
 * A part is new (a sphere, a ring, a band) or one the game data has, reused (`from`: its shape and
 * how its textures lie on it that part's). Each draws materials picked from those the game data
 * has, kept by where they are (`sources`: the planet, the overlay or the sky in the game data that
 * has each), and read from there as the part is built, so a material is as the data has it, its
 * settings set over it as any material's are. Nothing is copied.
 */

/** What an overlay is worn on: a planet (or moon), or the sky. */
export type OverlayKind = 'planet' | 'sky';

/** The shapes a new part can take: a sphere, a ring, a tube, a cone or a disc (a planet's), a band (the sky's). */
export type CreatedShape =
  'sphere' | 'ring' | 'tube' | 'cone' | 'disc' | 'capsule' | 'plane' | 'band';

/**
 * Where a part is in the game data, to be reused: a planet's or a data overlay's (by its id, else
 * its role), or one of the sky's overlays' (by its id).
 */
export type PartSource =
  | { readonly kind: 'planet' | 'style'; readonly id: string; readonly part: string }
  | { readonly kind: 'sky'; readonly overlay: string; readonly part: string };

/**
 * A part made in the editor: which it is, its shape (a reused one's: the shape its data has, a sky's
 * being a mesh), the materials it draws, in order, and where it is in the game data, where reused.
 */
export interface CreatedPart {
  readonly id: string;
  readonly shape: CreatedShape | 'mesh';
  readonly materials: readonly string[];
  readonly from?: PartSource;
}

/** Whether a part is a sky's (about the eye) rather than a planet's (about the body). */
export const skyShape = (shape: CreatedPart['shape']) => shape === 'band' || shape === 'mesh';

/** Where in the game data a material is: a planet's file, an overlay's (a style's), or the sky's. */
export type MaterialSource =
  | { readonly kind: 'planet'; readonly id: string }
  | { readonly kind: 'style'; readonly id: string }
  | { readonly kind: 'sky' };

/** Parts made in the editor and where the materials they draw are in the game data, by name. */
export interface Sourced {
  readonly parts: readonly CreatedPart[];
  readonly sources: Readonly<Record<string, MaterialSource>>;
}

/** An overlay made in the editor: what it is worn on, its name, its parts, and where the materials they draw are. */
export interface CreatedOverlay extends Sourced {
  readonly kind: OverlayKind;
  /** Its name as made (renamed: by its settings' `label`, as any overlay is). */
  readonly label: string;
}

/**
 * A part added straight onto a body or a sky (its own), with where the materials it draws are: it
 * stands on its own, wherever it is kept.
 */
export interface AddedPart extends CreatedPart {
  readonly sources: Readonly<Record<string, MaterialSource>>;
}

/** Parts added at several levels, the later over the earlier (one of the same id in its place). */
export function mergeAddedParts(
  ...levels: readonly (readonly AddedPart[] | undefined)[]
): AddedPart[] {
  const out: AddedPart[] = [];
  for (const level of levels)
    for (const part of level ?? []) {
      const at = out.findIndex((p) => p.id === part.id);
      if (at >= 0) out[at] = part;
      else out.push(part);
    }
  return out;
}

/** Added parts as made parts and where their materials are. */
export const addedSourced = (parts: readonly AddedPart[]): Sourced => ({
  parts,
  sources: Object.assign({}, ...parts.map((p) => p.sources)) as Sourced['sources'],
});

/** The file a material's source is loaded from (the sky's: none, the scene's own, always loaded). */
export const sourceFile = (source: MaterialSource): string | undefined =>
  source.kind === 'planet'
    ? source.id
    : source.kind === 'style'
      ? overlayFile(source.id)
      : undefined;

/** The file a reused part is loaded from (the sky's: none, the scene's own, always loaded). */
export const partSourceFile = (from: PartSource): string | undefined =>
  from.kind === 'planet' ? from.id : from.kind === 'style' ? overlayFile(from.id) : undefined;

/** The files parts made in the editor read their materials (and reused parts) from. */
export const sourceFiles = (o: Sourced): string[] => [
  ...new Set([
    ...Object.values(o.sources).flatMap((s) => sourceFile(s) ?? []),
    ...o.parts.flatMap((p) => (p.from ? (partSourceFile(p.from) ?? []) : [])),
  ]),
];

/** Whether parts made in the editor read anything of the sky's (a material, or a part). */
const readsSky = (o: Sourced) =>
  Object.values(o.sources).some((s) => s.kind === 'sky') ||
  o.parts.some((p) => p.from?.kind === 'sky');

/** A material as the game data has it where it is, and the textures of what has it (by key). */
export interface FoundMaterial {
  readonly material: SceneMaterial;
  readonly textures: Readonly<Record<string, SceneTexture>>;
}

/** Finds materials and parts where they are in the game data (none: not there, or not loaded yet). */
export interface SourceLookup {
  material(source: MaterialSource, name: string): FoundMaterial | undefined;
  /** A planet's or a data overlay's part. */
  bodyPart(from: PartSource): BodyPart | undefined;
  /** One of the sky's overlays' parts. */
  skyPart(from: PartSource): SkyPart | undefined;
}

/**
 * Finds materials and parts in the files loaded (by id: planets', overlays') and the scene (the
 * sky's own, and its overlays' in the data).
 */
export function lookupIn(
  files: Readonly<Record<string, PlanetFile | undefined>>,
  scene: PlayScene | null | undefined,
): SourceLookup {
  return {
    material: (source, name) => {
      if (source.kind === 'sky') {
        if (!scene) return undefined;
        const overlay = Object.values(scene.overlays ?? {}).find((o) => o.materials[name]);
        const material = scene.materials[name] ?? overlay?.materials[name];
        return material
          ? { material, textures: { ...scene.textures, ...overlay?.textures } }
          : undefined;
      }
      const file = files[sourceFile(source)!];
      const material = file?.materials[name];
      return material && file ? { material, textures: file.textures } : undefined;
    },
    bodyPart: (from) => {
      if (from.kind === 'sky') return undefined;
      return files[partSourceFile(from)!]?.parts.find((p) => partId(p) === from.part);
    },
    skyPart: (from) =>
      from.kind === 'sky'
        ? scene?.overlays?.[from.overlay]?.parts.find((p) => p.id === from.part)
        : undefined,
  };
}

/**
 * What parts made in the editor are built from, loaded: the files their materials (and reused
 * parts) are in (`file` loads one, with its textures' images) and the scene (`scene`, where the
 * sky's are): how to find them, and the images of the textures they read.
 */
export async function loadSources(
  o: Sourced,
  file: (id: string) => Promise<LoadedPlanet>,
  scene: () => Promise<LoadedPlayScene>,
): Promise<{ lookup: SourceLookup; images: Record<string, ImageBitmap> }> {
  const ids = sourceFiles(o);
  const [loaded, own] = await Promise.all([
    Promise.all(ids.map(file)),
    readsSky(o) ? scene() : Promise.resolve(undefined),
  ]);
  const lookup = lookupIn(
    Object.fromEntries(ids.map((id, i) => [id, loaded[i]!.planet])),
    own?.scene,
  );
  return { lookup, images: Object.assign({}, own?.images, ...loaded.map((l) => l.images)) };
}

/** Parts' materials as found where they are (those not found yet left out), and the textures they read. */
function found(
  o: Sourced,
  lookup: SourceLookup,
): {
  materials: Record<string, SceneMaterial>;
  textures: Record<string, SceneTexture>;
} {
  const materials: Record<string, SceneMaterial> = {};
  const textures: Record<string, SceneTexture> = {};
  for (const [name, source] of Object.entries(o.sources)) {
    const f = lookup.material(source, name);
    if (!f) continue;
    materials[name] = f.material;
    for (const layer of [
      f.material.diffuse,
      f.material.emissive,
      f.material.specular,
      ...f.material.alphaMasks,
    ]) {
      const key = layer?.texture;
      const texture = key ? f.textures[key] : undefined;
      if (key && texture) textures[key] = texture;
    }
  }
  return { materials, textures };
}

/** The shapes a planet's overlay's parts may take, and the sky's. */
export const PART_SHAPES: Readonly<Record<OverlayKind, readonly CreatedShape[]>> = {
  planet: ['sphere', 'ring', 'tube', 'cone', 'disc', 'capsule', 'plane'],
  sky: ['band'],
};

/**
 * A sphere part as it starts: a little bigger than the body (in its radii), seen from the front,
 * its textures round it once, top to bottom.
 */
const SPHERE: Pick<BodyPart, 'shape' | 'mapping'> = {
  shape: { kind: 'sphere', radius: 1.05, side: 'near' },
  mapping: {
    kind: 'sphere',
    pole: [0, 0, 1],
    meridian: [0, -1, 0],
    flip: false,
    u0: 0,
    // v evenly from the pole to the opposite one, at the steps the renderer reads it at.
    v: Array.from({ length: V_SAMPLES }, (_, i) => i / (V_SAMPLES - 1)),
  },
};
/** A ring part as it starts: about the body, past its limb, facing the eye, brightest midway across. */
const RING: Pick<BodyPart, 'shape' | 'mapping'> = {
  shape: { kind: 'ring', inner: 1.25, outer: 1.6, depth: 0 },
  mapping: { kind: 'ring', from: Math.PI / 2, uMax: 1, mid: 0.5 },
};

/** A round shape's texture as it starts: once round its axis from the front, along it from `v0` to `v1`. */
const round = (along: 'height' | 'radius', v0: number, v1: number, axis: Vec3 = [0, 0, 1]) =>
  ({
    kind: 'round',
    axis,
    meridian: [0, -1, 0],
    flip: false,
    u0: 0,
    repeat: 1,
    along,
    v0,
    v1,
  }) as const;
/** A disc's axis as it starts: up, tipped towards the eye (so it shows, as a planet's rings do). */
const DISC_AXIS: Vec3 = [0, -0.34, 0.94];
/** A plane as it starts: facing the eye, wider than the body. */
const PLANE = { kind: 'plane', width: 3, height: 2 } as const;
/** A tube, a cone, a disc, a capsule and a plane as each starts: about the body, upright (the disc tipped to the eye). */
const ROUND: Record<
  'tube' | 'cone' | 'disc' | 'capsule' | 'plane',
  Pick<BodyPart, 'shape' | 'mapping'>
> = {
  tube: {
    shape: { kind: 'tube', radius: 1.2, length: 2.4, side: 'near' },
    mapping: round('height', 1.2, -1.2),
  },
  cone: {
    shape: { kind: 'cone', bottom: 1.4, top: 0.5, length: 2.4, side: 'near' },
    mapping: round('height', 1.2, -1.2),
  },
  disc: {
    shape: { kind: 'disc', inner: 1.3, outer: 1.9, axis: DISC_AXIS },
    mapping: round('radius', 1.3, 1.9, DISC_AXIS),
  },
  capsule: {
    shape: { kind: 'capsule', radius: 0.7, length: 1.6, side: 'near' },
    mapping: round('height', 1.5, -1.5),
  },
  plane: { shape: PLANE, mapping: planeMapping(PLANE) },
};

/**
 * A planet's part made in the editor as built: a new one's shape, or a reused one's (its data's,
 * once loaded), drawing those of its materials found (none: not a planet's, or not loaded yet).
 */
function bodyPartOf(
  p: CreatedPart,
  lookup: SourceLookup,
  materials: Readonly<Record<string, SceneMaterial>>,
): BodyPart | undefined {
  const drawn = p.materials.filter((m) => materials[m]);
  if (p.from) {
    const data = lookup.bodyPart(p.from);
    return data ? { ...data, id: p.id, materials: drawn } : undefined;
  }
  if (p.shape === 'band' || p.shape === 'mesh') return undefined;
  return {
    id: p.id,
    role: p.shape,
    ...(p.shape === 'ring' ? RING : p.shape === 'sphere' ? SPHERE : ROUND[p.shape]),
    materials: drawn,
  };
}

/** A sky's part made in the editor as built: a band, or a reused one (its data's, once loaded). */
function skyPartOf(
  p: CreatedPart,
  lookup: SourceLookup,
  materials: Readonly<Record<string, SceneMaterial>>,
): SkyPart | undefined {
  const drawn = p.materials.filter((m) => materials[m]);
  if (p.from) {
    const data = lookup.skyPart(p.from);
    return data ? { ...data, id: p.id, materials: drawn } : undefined;
  }
  return p.shape === 'band' ? { id: p.id, shape: BAND, materials: drawn } : undefined;
}

/**
 * Planets' parts made in the editor as a style's file: the parts about the body, their materials
 * as found where they are (`lookup`).
 */
export function createdPlanetFile(o: Sourced, lookup: SourceLookup): PlanetFile {
  const { materials, textures } = found(o, lookup);
  return {
    kind: 'style',
    parts: o.parts.flatMap((p) => bodyPartOf(p, lookup, materials) ?? []),
    materials,
    textures,
  };
}

/**
 * The planets' overlays made in the editor, their materials as found where they are (`lookup`):
 * each by the file it is loaded as (`overlayFileFor`).
 */
export function createdFiles(
  library: LibraryState,
  lookup: SourceLookup,
): Record<string, PlanetFile> {
  return Object.fromEntries(
    Object.entries(library.created ?? {})
      .filter(([, o]) => o.kind === 'planet')
      .map(([id, o]) => [overlayFileFor(library, id), createdPlanetFile(o, lookup)]),
  );
}

/**
 * A body's file with the parts added onto it (its own, after its data's): their materials as found
 * where they are, its own drawn as it has them.
 */
export function withAddedParts(
  file: PlanetFile,
  parts: readonly AddedPart[] | undefined,
  lookup: SourceLookup,
): PlanetFile {
  if (!parts?.length) return file;
  const added = createdPlanetFile(addedSourced(parts), lookup);
  return {
    ...file,
    parts: [...file.parts, ...added.parts],
    materials: { ...added.materials, ...file.materials },
    textures: { ...added.textures, ...file.textures },
  };
}

/** A short key that changes when something made in the editor does (so it is built again). */
export function createdRevision(o: unknown): string | undefined {
  if (!o) return undefined;
  const text = JSON.stringify(o);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/** An overlay's name: as renamed in the library, else as made (one made in the editor), else its id. */
export const overlayName = (library: LibraryState, id: string) =>
  library.styles[id]?.label ?? library.created?.[id]?.label ?? id;

/** The file an overlay is loaded from as the library has it (one made in the editor: as it is now). */
export const overlayFileFor = (library: LibraryState, id: string) =>
  overlayFile(id, createdRevision(library.created?.[id]));

/** The overlay made in the editor a loaded file's id names (`@overlay-1#rev`), if any. */
export const createdOf = (library: LibraryState, file: string): CreatedOverlay | undefined =>
  createdOverlay(file) ? library.created?.[file.split('#')[0]!] : undefined;

/**
 * A sky's parts made in the editor as the sky draws them: its bands about the eye, and the parts of
 * its overlays reused; their materials as found where they are (`lookup`).
 */
export function createdSkyFile(
  o: Sourced & { readonly label?: string },
  lookup: SourceLookup,
): SkyOverlayFile {
  const { materials, textures } = found(o, lookup);
  return {
    ...(o.label !== undefined ? { label: o.label } : {}),
    parts: o.parts.flatMap((p) => skyPartOf(p, lookup, materials) ?? []),
    materials,
    textures,
  };
}

/** The next free id for an overlay made in the editor (`@overlay-<n>`), and its number. */
export function nextOverlayId(library: LibraryState): { id: string; n: number } {
  let n = 1;
  while (library.created?.[`${CREATED_OVERLAY}${n}`]) n++;
  return { id: `${CREATED_OVERLAY}${n}`, n };
}

/** Parts made in the editor without the sources of materials none of them draws. */
export function withUnused<T extends Sourced>(o: T): T {
  const drawn = new Set(o.parts.flatMap((p) => p.materials));
  return {
    ...o,
    sources: Object.fromEntries(Object.entries(o.sources).filter(([n]) => drawn.has(n))),
  };
}

/** An added part without the sources of materials it doesn't draw. */
export function addedWithUnused(p: AddedPart): AddedPart {
  return {
    ...p,
    sources: Object.fromEntries(Object.entries(p.sources).filter(([n]) => p.materials.includes(n))),
  };
}

/** The next free id for a part (`ring-2`) among those its owner has (`taken`: ids, or roles). */
export function nextPartId(taken: readonly string[], base: string): string {
  let n = 1;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
