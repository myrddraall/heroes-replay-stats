import { BUILT_IN_PREFIX, type BuiltInPlanets } from './built-in-planets';
import type { PlanetFile, PlanetIndex } from './planet-files';

/** A planet with its textures decoded, ready to draw. */
export interface LoadedPlanet {
  readonly id: string;
  /** What it is called where it isn't its id (one the app makes). */
  readonly label?: string;
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

  /** `builtIns`: the planets the app makes (their ids start `@`), where there are any. */
  constructor(
    private readonly base: string,
    private readonly builtIns?: BuiltInPlanets,
  ) {}

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
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('aborted', 'AbortError'),
        );
        return;
      }
      const abort = () =>
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('aborted', 'AbortError'),
        );
      signal.addEventListener('abort', abort, { once: true });
      loading.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  private async fetch(id: string): Promise<LoadedPlanet> {
    const built = id.startsWith(BUILT_IN_PREFIX) ? this.builtIns?.(id) : undefined;
    if (id.startsWith(BUILT_IN_PREFIX) && !built) throw new Error(`no planet ${id} is made here`);
    const planet = built?.planet ?? (await loadPlanetFile(this.base, id));
    const entries = await Promise.all(
      Object.entries(planet.textures).map(async ([key, texture]) => {
        const made = built?.images?.[key];
        if (made) return [key, await made()] as const;
        const image = await fetchOk(at(this.base, texture.file), `the texture ${texture.file}`);
        const bitmap = await createImageBitmap(await image.blob(), {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        });
        return [key, bitmap] as const;
      }),
    );
    return { id, label: built?.label, planet, images: Object.fromEntries(entries) };
  }
}
