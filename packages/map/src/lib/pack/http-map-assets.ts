import { PMTiles } from 'pmtiles';
import type { MapAssets, TileArchive } from './map-assets';
import type { MapPack } from './map-pack';

async function fetched(url: string, abortSignal: AbortSignal): Promise<Response> {
  const answer = await fetch(url, { signal: abortSignal });
  if (!answer.ok) throw new Error(`${url}: ${answer.status} ${answer.statusText}`);
  return answer;
}

/**
 * A pack's files served over HTTP from its folder: the tile pyramids read by range requests
 * (PMTiles), the rest fetched whole.
 */
export class HttpMapAssets implements MapAssets {
  private readonly archives = new Map<string, PMTiles>();

  constructor(
    private readonly pack: MapPack,
    /** The pack's folder, ending in `/`. */
    private readonly folder: string,
  ) {}

  url(file: string): string {
    return new URL(file, this.folder).href;
  }

  tiles(layerId: string): TileArchive {
    let archive = this.archives.get(layerId);
    if (!archive) {
      const layer = this.pack.layers.find((l) => l.id === layerId && l.kind !== 'fixed');
      if (!layer) throw new Error(`${this.pack.map.id}'s pack has no tiled layer ${layerId}`);
      archive = new PMTiles(this.url(layer.file));
      this.archives.set(layerId, archive);
    }
    return archive;
  }

  async picture(file: string, abortSignal: AbortSignal): Promise<ImageBitmap> {
    const answer = await fetched(this.url(file), abortSignal);
    return createImageBitmap(await answer.blob());
  }

  async text(file: string, abortSignal: AbortSignal): Promise<string> {
    return (await fetched(this.url(file), abortSignal)).text();
  }
}
