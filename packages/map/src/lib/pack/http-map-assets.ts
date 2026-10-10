import { PMTiles } from 'pmtiles';
import type { MapAssets, TileArchive } from './map-assets';
import type { MapPack } from './map-pack';

/**
 * A file fetched, at low priority unless asked otherwise: the browser then queues it behind
 * the tile pyramids' requests, so the terrain shows first.
 */
async function fetched(
  url: string,
  abortSignal: AbortSignal,
  priority: 'high' | 'low' = 'low',
): Promise<Response> {
  const answer = await fetch(url, { signal: abortSignal, priority });
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

  /**
   * A file's URL, with its hash from the pack's `files` as a version (PACK.md: a viewer can cache
   * by hash): a server may then cache it for good, and a new render, with new hashes, still shows
   * at once.
   */
  url(file: string): string {
    const url = new URL(file, this.folder);
    const hash = this.pack.files?.[file]?.sha256;
    if (hash) url.searchParams.set('v', hash.slice(0, 12));
    return url.href;
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

  async picture(
    file: string,
    abortSignal: AbortSignal,
    priority: 'high' | 'low' = 'low',
  ): Promise<ImageBitmap> {
    const answer = await fetched(this.url(file), abortSignal, priority);
    return createImageBitmap(await answer.blob());
  }

  async text(file: string, abortSignal: AbortSignal): Promise<string> {
    return (await fetched(this.url(file), abortSignal)).text();
  }
}
