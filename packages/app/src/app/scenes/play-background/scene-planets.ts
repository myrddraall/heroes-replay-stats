import type { SceneColor, SceneMaterial, SceneTexture } from './play-scene';

/**
 * The planets heroes-capture exports beside the Play screen's scene (`heroes-capture ui
 * background`, planets/), for the background to put up in sets of its own: the Play screen's
 * three, and the tutorial flyby's worlds and painted spheres. A planet is a body of parts, each a
 * shape about its centre (a sphere, seen from outside or from inside; a flat ring) in units of the
 * body's radius, mapped to its materials' textures by a rule, in the body's own frame: x to the
 * right, y away from the eye, z up, which the background turns to face its camera, as the game's
 * billboards do. The renderer draws each part on one camera-facing square, finding the shape under
 * each pixel: no mesh is loaded.
 */

/**
 * Which the planet is: the Play screen's own, a flyby world, or a painted sphere; or a style, parts
 * to put about any planet's body (the nexus style: the Play screen's hex-grid shield and ring,
 * and a light that shades the body as the Play screen paints its own).
 */
export type PlanetKind = 'play' | 'world' | 'painted' | 'style';

export interface PlanetIndexEntry {
  readonly id: string;
  readonly kind: PlanetKind;
}

/** One of the Play screen's own planets where the game puts it, at its body's radius there. */
export interface PlayPlacement {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

export interface PlanetIndex {
  readonly planets: readonly PlanetIndexEntry[];
  /** The Play screen's own set. */
  readonly play: readonly PlayPlacement[];
  /** The styles there are (files `style-<id>`). */
  readonly styles: readonly { readonly id: string }[];
}

/** A directional light: the way it travels, and its colour (times its multiplier). */
export interface PlanetDirectionalLight {
  readonly direction: readonly [number, number, number];
  readonly color: readonly [number, number, number];
}

/**
 * How a planet is lit, in its own frame, as the flyby lights it: an ambient colour, directional
 * lights, and the exposure the flyby showed it at (the background scales what it lights by this
 * over its own exposure, so the planet is as bright as the tutorial showed it).
 */
export interface PlanetLight {
  readonly ambient: readonly [number, number, number];
  readonly directional: readonly PlanetDirectionalLight[];
  readonly exposure: number;
  /** What the light's HDR blooms, where it is lower than the scene's: the planet glows past it. */
  readonly bloomThreshold?: number;
}

type Vec3 = readonly [number, number, number];

/**
 * A part's shape, in units of the body's radius: a sphere seen from its near side (the body, an
 * outer cloud layer) or its far side (an atmosphere shell modelled inside out: what shows is its
 * far side past the body's limb); or a flat ring in the plane facing the eye, `depth` along the
 * body's y (negative: towards the eye).
 */
export type PartShape =
  | {
      readonly kind: 'sphere';
      readonly radius: number;
      readonly side: 'near' | 'far';
      /** Where its centre is, from the body's (a moon's): the body's by default. */
      readonly centre?: Vec3;
    }
  | { readonly kind: 'ring'; readonly inner: number; readonly outer: number; readonly depth: number };

/**
 * How a part's surface maps to its materials' texture coordinates. A uv sphere: u round the pole
 * from the meridian (the other way round when flipped), from u0; v by the angle from the pole,
 * `v` its values at even steps from the pole to the opposite one (as the game's mesh has it: not
 * always a straight line). Linear: u and v each a·x + b·y + c·z + d of the point. A ring: u greatest
 * (uMax) at the azimuth `from` (radians in the body's xz plane, from +x towards +z), falling to 0
 * at the opposite side either way round; v 0 at both edges, 1 midway.
 */
export type PartMapping =
  | {
      readonly kind: 'sphere';
      readonly pole: Vec3;
      readonly meridian: Vec3;
      readonly flip: boolean;
      readonly u0: number;
      readonly v: readonly number[];
    }
  | {
      readonly kind: 'linear';
      readonly u: readonly [number, number, number, number];
      readonly v: readonly [number, number, number, number];
    }
  | { readonly kind: 'ring'; readonly from: number; readonly uMax: number };

/** What a part is to its body: its surface, a layer on it, its atmosphere shell, a ring, a style's shield. */
export type PartRole = 'surface' | 'layer' | 'shell' | 'ring' | 'shield';

/**
 * How strongly a role's parts show unless a placement says otherwise, 0 to 1: the haze layers
 * over a world's surface (Korhal's edge lights) at 0.42, the user's choice over the data's full
 * strength; the rest as the data has them.
 */
export const DEFAULT_STRENGTHS: Readonly<Partial<Record<PartRole, number>>> = { layer: 0.42 };

export interface BodyPart {
  readonly role: PartRole;
  readonly shape: PartShape;
  readonly mapping: PartMapping;
  /** The mesh's second texture coordinates, where a layer reads them and a rule fits them. */
  readonly mapping2?: PartMapping;
  /** The materials drawn on it, in order (a composite material's sections). */
  readonly materials: readonly string[];
  /** The vertex colour the materials that use one multiply by. */
  readonly color?: SceneColor;
}

/**
 * A darkening of a body from a side, apart from its lights: where the surface faces `direction`
 * (in the body's frame) its colour is cut by `strength` (0 to 1), coming on as the facing to the
 * power `softness` (1: as a light would; higher: more gradually). Its lights and emissive layers
 * aren't shaded.
 */
export interface BodyShade {
  readonly direction: Vec3;
  readonly strength: number;
  readonly softness: number;
}

/** The shade's direction unless one is given: from the lower left and in front. */
export const DEFAULT_SHADE: BodyShade = { direction: [-0.78, -0.3, -0.55], strength: 0, softness: 1 };

export interface PlanetFile {
  readonly kind: PlanetKind;
  /** The body's parts: its surface first (the opaque one), then what is over or about it. */
  readonly parts: readonly BodyPart[];
  readonly materials: Readonly<Record<string, SceneMaterial>>;
  readonly textures: Readonly<Record<string, SceneTexture>>;
  /** None for the Play screen's own, whose lighting is painted in. */
  readonly light?: PlanetLight;
  /** A style's shade on the body it dresses. */
  readonly shade?: BodyShade;
  /** How the planet is best shown, where the data alone isn't it (heroes-capture's tuning, by eye against the game). */
  readonly tuning?: PlanetTuning;
}

/** Settings a planet is shown with unless a placement says otherwise. */
export interface PlanetTuning {
  readonly style?: string;
  readonly glow?: number;
  readonly lighting?: number;
  readonly shade?: Partial<BodyShade>;
  readonly strengths?: Partial<Record<PartRole, number>>;
}

/** A planet with its textures decoded, ready to draw. */
export interface LoadedPlanet {
  readonly id: string;
  readonly planet: PlanetFile;
  readonly images: Readonly<Record<string, ImageBitmap>>;
}

const at = (base: string, file: string) => new URL(file, new URL(base, document.baseURI)).href;

async function fetchOk(url: string, what: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${what} (${response.status} ${response.statusText})`);
  return response;
}

/** The planets there are, from the scene's directory. */
export async function loadPlanetIndex(base: string, signal?: AbortSignal): Promise<PlanetIndex> {
  const response = await fetchOk(at(base, 'planets/index.json'), 'the planets', signal);
  return (await response.json()) as PlanetIndex;
}

/** A planet's file from the scene's directory, as exported (its textures not loaded). */
export async function loadPlanetFile(
  base: string,
  id: string,
  signal?: AbortSignal,
): Promise<PlanetFile> {
  const response = await fetchOk(at(base, `planets/${id}.json`), `the planet ${id}`, signal);
  const planet = (await response.json()) as PlanetFile;
  if (!planet.parts?.length) throw new Error(`the planet ${id} has no parts`);
  return planet;
}

/**
 * Loads planets from the scene's directory, each once (the textures are the scene's, beside it,
 * decoded as stored, as the scene's are: nothing premultiplied or colour-converted). A load is
 * shared by all who ask for the planet, so no one's abort stops it: a caller that no longer
 * wants it just stops waiting (its signal rejects its own wait).
 */
export class PlanetLoader {
  private readonly loading = new Map<string, Promise<LoadedPlanet>>();

  constructor(private readonly base: string) {}

  load(id: string, signal?: AbortSignal): Promise<LoadedPlanet> {
    let loading = this.loading.get(id);
    if (!loading) {
      loading = this.fetch(id).catch((error: unknown) => {
        this.loading.delete(id); // not kept: asked for again, it is tried again
        throw error;
      });
      this.loading.set(id, loading);
    }
    if (!signal) return loading;
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('aborted', 'AbortError'));
        return;
      }
      const abort = () =>
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('aborted', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      loading.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  private async fetch(id: string): Promise<LoadedPlanet> {
    const planet = await loadPlanetFile(this.base, id);
    const entries = await Promise.all(
      Object.entries(planet.textures).map(async ([key, texture]) => {
        const image = await fetchOk(at(this.base, texture.file), `the texture ${texture.file}`);
        const bitmap = await createImageBitmap(await image.blob(), {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        });
        return [key, bitmap] as const;
      }),
    );
    return { id, planet, images: Object.fromEntries(entries) };
  }
}
