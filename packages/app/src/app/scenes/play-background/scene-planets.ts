import type { SceneMaterial, SceneMesh, SceneTexture } from './play-scene';

/**
 * The planets heroes-capture exports beside the Play screen's scene (`heroes-capture ui
 * background`, planets/), for the background to put up in sets of its own: the Play screen's
 * three as templates, and the tutorial flyby's worlds and painted spheres. Each file is a planet in
 * its own space: its body a unit sphere (or hemisphere) at the origin facing -Y, which the
 * background turns to face its camera, as the game's billboards do.
 */

/** Which the planet is: the Play screen's own, a flyby world with its own meshes, or a painted sphere. */
export type PlanetKind = 'play' | 'world' | 'painted';

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
}

/** A directional light: the way it travels, and its colour (times its multiplier). */
export interface PlanetDirectionalLight {
  readonly direction: readonly [number, number, number];
  readonly color: readonly [number, number, number];
}

/**
 * How a planet is lit, in its own space, as the flyby lights it: an ambient colour, directional
 * lights, and the exposure the flyby showed it at (the background scales what it lights by this
 * over its own exposure, so the planet is as bright as the tutorial showed it).
 */
export interface PlanetLight {
  readonly ambient: readonly [number, number, number];
  readonly directional: readonly PlanetDirectionalLight[];
  readonly exposure: number;
}

export interface PlanetFile {
  readonly kind: PlanetKind;
  /** The body's radius in the file's units: 1. */
  readonly radius: number;
  /** `body` is the planet itself; `atmosphere` the disc behind it; a world's details by their names. */
  readonly meshes?: Readonly<Record<string, SceneMesh>>;
  /** A painted sphere has a template's meshes instead, its body in these materials. */
  readonly template?: string;
  readonly body?: readonly string[];
  readonly materials: Readonly<Record<string, SceneMaterial>>;
  readonly textures: Readonly<Record<string, SceneTexture>>;
  /** None for the Play screen's own, whose lighting is painted in. */
  readonly light?: PlanetLight;
}

/** A planet with its meshes (its template's, where it has one) and its textures decoded, ready to draw. */
export interface LoadedPlanet {
  readonly id: string;
  readonly planet: PlanetFile & { readonly meshes: Readonly<Record<string, SceneMesh>> };
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

/**
 * Loads planets from the scene's directory, each once (the textures are the scene's, beside it,
 * decoded as stored, as the scene's are: nothing premultiplied or colour-converted). A painted
 * sphere's template is loaded with it, and its meshes are the template's, its body in its own
 * materials.
 */
export class PlanetLoader {
  private readonly loading = new Map<string, Promise<LoadedPlanet>>();

  constructor(private readonly base: string) {}

  load(id: string, signal?: AbortSignal): Promise<LoadedPlanet> {
    let loading = this.loading.get(id);
    if (!loading) {
      loading = this.fetch(id, signal).catch((error: unknown) => {
        this.loading.delete(id); // not kept: asked for again, it is tried again
        throw error;
      });
      this.loading.set(id, loading);
    }
    return loading;
  }

  private async fetch(id: string, signal?: AbortSignal): Promise<LoadedPlanet> {
    const response = await fetchOk(at(this.base, `planets/${id}.json`), `the planet ${id}`, signal);
    const file = (await response.json()) as PlanetFile;
    const [entries, template] = await Promise.all([
      Promise.all(
        Object.entries(file.textures).map(async ([key, texture]) => {
          const image = await fetchOk(
            at(this.base, texture.file),
            `the texture ${texture.file}`,
            signal,
          );
          const bitmap = await createImageBitmap(await image.blob(), {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none',
          });
          return [key, bitmap] as const;
        }),
      ),
      file.template ? this.load(file.template, signal) : null,
    ]);
    let meshes = file.meshes;
    if (template) {
      const body = template.planet.meshes['body'];
      if (!body) throw new Error(`the planet ${id}'s template ${file.template} has no body`);
      meshes = {
        ...template.planet.meshes,
        body: { ...body, materials: file.body ?? body.materials },
      };
    }
    if (!meshes) throw new Error(`the planet ${id} has no meshes and no template`);
    return {
      id,
      planet: { ...file, meshes },
      images: { ...template?.images, ...Object.fromEntries(entries) },
    };
  }
}
