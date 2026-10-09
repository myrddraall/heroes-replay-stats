import { inject, InjectionToken, Service } from '@angular/core';
import type { MapCatalog } from './map-catalog';
import { MAP_PACK_FORMAT, type MapPack } from './map-pack';
import { HttpMapAssets } from './http-map-assets';
import type { MapViewModel } from './map-assets';

/** Where the map packs are: heroes-maps' `maps/` folder, its catalog at `index.json`. */
export const MAP_PACKS_URL = new InjectionToken<string>('MAP_PACKS_URL', {
  factory: () => 'https://myrddraall.github.io/heroes-maps/maps/',
});

async function json<T>(url: string, abortSignal?: AbortSignal): Promise<T> {
  const answer = await fetch(url, abortSignal ? { signal: abortSignal } : {});
  if (!answer.ok) throw new Error(`${url}: ${answer.status} ${answer.statusText}`);
  return (await answer.json()) as T;
}

/** Reads heroes-maps: its catalog, and each map's pack. */
@Service()
export class MapPacksService {
  private readonly base = new URL(inject(MAP_PACKS_URL), globalThis.location?.href);

  /** Every map there is a pack of. */
  catalog(abortSignal?: AbortSignal): Promise<MapCatalog> {
    return json<MapCatalog>(new URL('index.json', this.base).href, abortSignal);
  }

  /** One map, by its id (`battlefield-of-eternity`): its pack, and where its files come from. */
  async open(mapId: string, abortSignal?: AbortSignal): Promise<MapViewModel> {
    const folder = new URL(`${encodeURIComponent(mapId)}/`, this.base).href;
    const pack = await json<MapPack>(new URL('pack.json', folder).href, abortSignal);
    if (pack.format !== MAP_PACK_FORMAT) {
      throw new Error(
        `This viewer reads map pack format ${MAP_PACK_FORMAT}; ${mapId}'s is format ${pack.format}.`,
      );
    }
    return { pack, assets: new HttpMapAssets(pack, folder) };
  }

  /** A file of the catalog's (a thumbnail), by its path relative to the catalog. */
  fileUrl(path: string): string {
    return new URL(path, this.base).href;
  }
}
