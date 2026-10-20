import type { LibraryState } from './background-design';
import type { BuiltInPlanets } from './built-in-planets';
import { CREATED_OVERLAY, createdOverlay, overlayFile } from './overlays';
import type { SceneMaterial, SceneTexture, SkyOverlayFile } from './play-scene';
import { BAND } from './sky-overlays';
import type { BodyPart, PlanetFile } from './scene-planets';
import { V_SAMPLES } from './scene-renderer';

/**
 * Overlays made in the editor (kept in the design's library, by an id starting `@overlay-`): a
 * planet's (parts about the body wearing it: spheres and rings) or the sky's (bands about the
 * eye), each part drawing materials picked from those the game data has. What a material is, is
 * copied in as it is picked, so the overlay stands on its own; its settings are by its name, as
 * any material's are (its base settings shared with wherever else it is used).
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

/** An overlay made in the editor: what it is worn on, its name, its parts, and the materials they draw. */
export interface CreatedOverlay {
  readonly kind: OverlayKind;
  /** Its name as made (renamed: by its settings' `label`, as any overlay is). */
  readonly label: string;
  readonly parts: readonly CreatedPart[];
  /** The materials its parts draw, by name, as they were where they were picked. */
  readonly materials: Readonly<Record<string, SceneMaterial>>;
  /** The textures those read, by key (the files the site has, as where they were picked). */
  readonly textures: Readonly<Record<string, SceneTexture>>;
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

/** A planet's overlay made in the editor as a style's file: its parts about the body, its materials. */
export function createdPlanetFile(o: CreatedOverlay): PlanetFile {
  return {
    kind: 'style',
    parts: o.parts
      .filter((p) => p.shape !== 'band')
      .map((p): BodyPart => ({
        id: p.id,
        role: p.shape === 'ring' ? 'ring' : 'sphere',
        ...(p.shape === 'ring' ? RING : SPHERE),
        materials: p.materials.filter((m) => o.materials[m]),
      })),
    materials: o.materials,
    textures: o.textures,
  };
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

/** A sky's overlay made in the editor as the sky draws it: its bands about the eye, its materials. */
export function createdSkyFile(o: CreatedOverlay): SkyOverlayFile {
  return {
    label: o.label,
    parts: o.parts
      .filter((p) => p.shape === 'band')
      .map((p) => ({
        id: p.id,
        shape: BAND,
        materials: p.materials.filter((m) => o.materials[m]),
      })),
    materials: o.materials,
    textures: o.textures,
  };
}

/**
 * The overlays made in the editor, built as the app's own planets are (see `BuiltInPlanets`): a
 * planet's as a style's file; a sky's as one with no parts, for its textures to load by.
 */
export const createdBuiltIns =
  (library: () => LibraryState): BuiltInPlanets =>
  (id) => {
    const o = createdOf(library(), id);
    if (!o) return undefined;
    return {
      planet:
        o.kind === 'planet'
          ? createdPlanetFile(o)
          : { kind: 'style', parts: [], materials: o.materials, textures: o.textures },
    };
  };

/** The next free id for an overlay made in the editor (`@overlay-<n>`), and its number. */
export function nextOverlayId(library: LibraryState): { id: string; n: number } {
  let n = 1;
  while (library.created?.[`${CREATED_OVERLAY}${n}`]) n++;
  return { id: `${CREATED_OVERLAY}${n}`, n };
}

/** An overlay made in the editor without the materials (and textures) none of its parts draw. */
export function withUnused(o: CreatedOverlay): CreatedOverlay {
  const drawn = new Set(o.parts.flatMap((p) => p.materials));
  const materials = Object.fromEntries(Object.entries(o.materials).filter(([n]) => drawn.has(n)));
  const read = new Set(
    Object.values(materials).flatMap((m) =>
      [m.diffuse, m.emissive, ...m.alphaMasks].flatMap((l) => (l?.texture ? [l.texture] : [])),
    ),
  );
  return {
    ...o,
    materials,
    textures: Object.fromEntries(Object.entries(o.textures).filter(([k]) => read.has(k))),
  };
}

/** The next free id for a part of a shape in an overlay made in the editor (`ring-2`). */
export function nextPartId(o: CreatedOverlay, shape: CreatedShape): string {
  let n = 1;
  while (o.parts.some((p) => p.id === `${shape}-${n}`)) n++;
  return `${shape}-${n}`;
}
