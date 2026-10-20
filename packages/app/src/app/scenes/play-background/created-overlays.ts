import type { LibraryState } from './background-design';
import { CREATED_OVERLAY, createdOverlay, overlayFile } from './overlays';
import type {
  LoadedPlayScene,
  PlayScene,
  SceneMaterial,
  SceneTexture,
  SkyOverlayFile,
} from './play-scene';
import { BAND } from './sky-overlays';
import type { BodyPart, LoadedPlanet, PlanetFile } from './scene-planets';
import { V_SAMPLES } from './scene-renderer';

/**
 * Overlays made in the editor (kept in the design's library, by an id starting `@overlay-`): a
 * planet's (parts about the body wearing it: spheres and rings) or the sky's (bands about the
 * eye), each part drawing materials picked from those the game data has. A material is kept by
 * where it comes from (`sources`: the planet, the overlay or the sky in the game data that has
 * it), and read from there as the overlay is built, so it is that material as the data has it;
 * its settings are set over it as any material's are.
 */

/** What an overlay is worn on: a planet (or moon), or the sky. */
export type OverlayKind = 'planet' | 'sky';

/** The shapes a part made in the editor can take: a sphere or a ring (a planet's), a band (the sky's). */
export type CreatedShape = 'sphere' | 'ring' | 'band';

/** A part of an overlay made in the editor: which it is, its shape, the materials it draws, in order. */
export interface CreatedPart {
  readonly id: string;
  readonly shape: CreatedShape;
  readonly materials: readonly string[];
}

/** Where in the game data a material is: a planet's file, an overlay's (a style's), or the sky's. */
export type MaterialSource =
  | { readonly kind: 'planet'; readonly id: string }
  | { readonly kind: 'style'; readonly id: string }
  | { readonly kind: 'sky' };

/** An overlay made in the editor: what it is worn on, its name, its parts, and where the materials they draw are. */
export interface CreatedOverlay {
  readonly kind: OverlayKind;
  /** Its name as made (renamed: by its settings' `label`, as any overlay is). */
  readonly label: string;
  readonly parts: readonly CreatedPart[];
  /** Where each material its parts draw is in the game data, by the material's name. */
  readonly sources: Readonly<Record<string, MaterialSource>>;
}

/** The file a material's source is loaded from (the sky's: none, the scene's own, always loaded). */
export const sourceFile = (source: MaterialSource): string | undefined =>
  source.kind === 'planet'
    ? source.id
    : source.kind === 'style'
      ? overlayFile(source.id)
      : undefined;

/** The files an overlay made in the editor reads its materials from. */
export const sourceFiles = (o: CreatedOverlay): string[] => [
  ...new Set(Object.values(o.sources).flatMap((s) => sourceFile(s) ?? [])),
];

/** A material as the game data has it where it is, and the textures of what has it (by key). */
export interface FoundMaterial {
  readonly material: SceneMaterial;
  readonly textures: Readonly<Record<string, SceneTexture>>;
}

/** Finds a material where it is in the game data (none: not there, or not loaded yet). */
export type MaterialLookup = (source: MaterialSource, name: string) => FoundMaterial | undefined;

/**
 * Finds materials in the files loaded (by id: planets', overlays') and the scene (the sky's own,
 * and its overlays' in the data).
 */
export function lookupIn(
  files: Readonly<Record<string, PlanetFile | undefined>>,
  scene: PlayScene | null | undefined,
): MaterialLookup {
  return (source, name) => {
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
  };
}

/**
 * What an overlay made in the editor is built from, loaded: the files its materials are in (`file`
 * loads one, with its textures' images) and the scene (`scene`, where the sky's are): how to find
 * them, and the images of the textures they read.
 */
export async function loadSources(
  o: CreatedOverlay,
  file: (id: string) => Promise<LoadedPlanet>,
  scene: () => Promise<LoadedPlayScene>,
): Promise<{ lookup: MaterialLookup; images: Record<string, ImageBitmap> }> {
  const ids = sourceFiles(o);
  const sky = Object.values(o.sources).some((s) => s.kind === 'sky');
  const [loaded, own] = await Promise.all([
    Promise.all(ids.map(file)),
    sky ? scene() : Promise.resolve(undefined),
  ]);
  const lookup = lookupIn(
    Object.fromEntries(ids.map((id, i) => [id, loaded[i]!.planet])),
    own?.scene,
  );
  return { lookup, images: Object.assign({}, own?.images, ...loaded.map((l) => l.images)) };
}

/** An overlay's materials as found where they are (those not found yet left out), and the textures they read. */
function found(
  o: CreatedOverlay,
  lookup: MaterialLookup,
): {
  materials: Record<string, SceneMaterial>;
  textures: Record<string, SceneTexture>;
} {
  const materials: Record<string, SceneMaterial> = {};
  const textures: Record<string, SceneTexture> = {};
  for (const [name, source] of Object.entries(o.sources)) {
    const f = lookup(source, name);
    if (!f) continue;
    materials[name] = f.material;
    for (const layer of [f.material.diffuse, f.material.emissive, ...f.material.alphaMasks]) {
      const key = layer?.texture;
      const texture = key ? f.textures[key] : undefined;
      if (key && texture) textures[key] = texture;
    }
  }
  return { materials, textures };
}

/** The shapes a planet's overlay's parts may take, and the sky's. */
export const PART_SHAPES: Readonly<Record<OverlayKind, readonly CreatedShape[]>> = {
  planet: ['sphere', 'ring'],
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

/**
 * A planet's overlay made in the editor as a style's file: its parts about the body, its materials
 * as found where they are (`lookup`).
 */
export function createdPlanetFile(o: CreatedOverlay, lookup: MaterialLookup): PlanetFile {
  const { materials, textures } = found(o, lookup);
  return {
    kind: 'style',
    parts: o.parts
      .filter((p) => p.shape !== 'band')
      .map((p): BodyPart => ({
        id: p.id,
        role: p.shape === 'ring' ? 'ring' : 'sphere',
        ...(p.shape === 'ring' ? RING : SPHERE),
        materials: p.materials.filter((m) => materials[m]),
      })),
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
  lookup: MaterialLookup,
): Record<string, PlanetFile> {
  return Object.fromEntries(
    Object.entries(library.created ?? {})
      .filter(([, o]) => o.kind === 'planet')
      .map(([id, o]) => [overlayFileFor(library, id), createdPlanetFile(o, lookup)]),
  );
}

/** A short key that changes when an overlay made in the editor does (so it is built again). */
export function createdRevision(o: CreatedOverlay | undefined): string | undefined {
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
 * A sky's overlay made in the editor as the sky draws it: its bands about the eye, its materials
 * as found where they are (`lookup`).
 */
export function createdSkyFile(o: CreatedOverlay, lookup: MaterialLookup): SkyOverlayFile {
  const { materials, textures } = found(o, lookup);
  return {
    label: o.label,
    parts: o.parts
      .filter((p) => p.shape === 'band')
      .map((p) => ({
        id: p.id,
        shape: BAND,
        materials: p.materials.filter((m) => materials[m]),
      })),
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

/** An overlay made in the editor without the sources of materials none of its parts draw. */
export function withUnused(o: CreatedOverlay): CreatedOverlay {
  const drawn = new Set(o.parts.flatMap((p) => p.materials));
  return {
    ...o,
    sources: Object.fromEntries(Object.entries(o.sources).filter(([n]) => drawn.has(n))),
  };
}

/** The next free id for a part of a shape in an overlay made in the editor (`ring-2`). */
export function nextPartId(o: CreatedOverlay, shape: CreatedShape): string {
  let n = 1;
  while (o.parts.some((p) => p.id === `${shape}-${n}`)) n++;
  return `${shape}-${n}`;
}
