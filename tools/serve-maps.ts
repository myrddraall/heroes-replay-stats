/**
 * The maps rendered on this machine, served the way heroes-maps serves its published ones, for
 * the app's `local` configuration (packages/app/tools/ng.ts): a catalog at /maps/index.json, each
 * map's pack at /maps/<map id>/, byte ranges (the viewer reads PMTiles in ranges) and CORS.
 *
 *   pnpm run serve.maps [folder] [port]
 *
 * The folder is heroes-capture's output (`maps\`): each map at <folder>/<id>/pack/ or, for an
 * elements render, <folder>/<id>/elements/pack/ (preferred). By default
 * ../heroes-capture/tmp/results/maps next to this repository, on port 4208. The packs are read as
 * they are, on every request: a new render shows on the next reload. Every pack is listed with its
 * format (`packFormat`, as heroes-maps' catalog gives it); the app shows only those it can read.
 */
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { MAP_PACK_FORMAT } from '../packages/map/src/lib/pack/map-pack.ts';

const [folderArg, portArg] = process.argv.slice(2);
const folder = resolve(
  folderArg ?? join(import.meta.dirname, '..', '..', 'heroes-capture', 'tmp', 'results', 'maps'),
);
const port = Number(portArg ?? 4208);

const types: Record<string, string> = {
  '.json': 'application/json',
  '.pmtiles': 'application/octet-stream',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
};

/** What the catalog takes from a pack (heroes-capture's PACK.md). */
interface Pack {
  readonly format: number;
  readonly map: {
    readonly id: string;
    readonly name: string;
    readonly category: string | null;
    readonly structures: string;
  };
  readonly gameBuild: number | null;
  readonly tool: string;
  readonly images: {
    readonly thumbnail?: { readonly file: string; readonly size: readonly [number, number] };
  };
}

/** A pack found: its folder and its pack.json. */
interface Found {
  readonly dir: string;
  readonly pack: Pack;
}

/** Every pack in the folder, by map id: the elements render's where there is one, else the plain one. */
async function allPacks(): Promise<Map<string, Found>> {
  const found = new Map<string, Found>();
  for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    for (const dir of [
      join(folder, entry.name, 'elements', 'pack'),
      join(folder, entry.name, 'pack'),
    ]) {
      const text = await readFile(join(dir, 'pack.json'), 'utf8').catch(() => null);
      if (text !== null) {
        found.set(entry.name, { dir, pack: JSON.parse(text) as Pack });
        break;
      }
    }
  }
  return found;
}

/** The catalog as heroes-maps writes it (its tools/catalog.mjs), from the packs found. */
async function catalog(): Promise<string> {
  const maps = [];
  for (const [id, { pack }] of await allPacks()) {
    const thumbnail = pack.images.thumbnail;
    maps.push({
      id,
      name: pack.map.name,
      category: pack.map.category,
      gameBuild: pack.gameBuild,
      tool: pack.tool,
      packFormat: pack.format,
      structures: pack.map.structures,
      path: `${id}/`,
      pack: `${id}/pack.json`,
      thumbnail: thumbnail ? { file: `${id}/${thumbnail.file}`, size: thumbnail.size } : null,
    });
  }
  return JSON.stringify({ format: 1, maps }, null, 2);
}

/** A versioned URL (`?v=<hash>`, as the viewer asks for the pack's files) may be cached for good. */
const headers = (type: string, versioned = false) => ({
  'content-type': type,
  'accept-ranges': 'bytes',
  'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Range',
  'access-control-expose-headers': 'Content-Range, Content-Length',
});

async function serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers('text/plain'));
    res.end();
    return;
  }
  if (path === '/maps/index.json') {
    const body = await catalog();
    res.writeHead(200, {
      ...headers('application/json'),
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  const [, id, name] = /^\/maps\/([^/]+)\/(.+)$/.exec(path) ?? [];
  const dir = id ? (await allPacks()).get(id)?.dir : undefined;
  const file = dir && name ? join(dir, name) : null;
  const info = file ? await stat(file).catch(() => null) : null;
  if (!file || !info?.isFile()) {
    res.writeHead(404, headers('text/plain'));
    res.end('not found');
    return;
  }
  const base = headers(
    types[extname(file)] ?? 'application/octet-stream',
    url.searchParams.has('v'),
  );
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : info.size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    res.writeHead(206, {
      ...base,
      'content-range': `bytes ${start}-${end}/${info.size}`,
      'content-length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...base, 'content-length': info.size });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  serve(req, res).catch((e: unknown) => {
    res.writeHead(500, headers('text/plain'));
    res.end(String(e));
  });
}).listen(port, async () => {
  const all = [...(await allPacks())];
  const named = all.map(([id, { pack }]) => `${id} (format ${pack.format})`);
  const where = `http://localhost:${port}/maps/`;
  console.log(
    `serving ${all.length} map(s) from ${folder} at ${where}: ${named.join(', ') || 'none yet'}`,
  );
  const unreadable = all.filter(([, { pack }]) => pack.format !== MAP_PACK_FORMAT).length;
  if (unreadable)
    console.log(
      `${unreadable} not pack format ${MAP_PACK_FORMAT}: the app lists only the ones it reads`,
    );
});
