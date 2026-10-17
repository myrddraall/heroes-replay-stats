/**
 * The maps rendered on this machine, served the way heroes-maps serves its published ones, for
 * the app's `local` configuration (tools/ng.ts): a catalog at /maps/index.json, each map's pack
 * at /maps/<map id>/, byte ranges (the viewer reads PMTiles in ranges) and CORS.
 *
 *   pnpm run serve.maps [folder] [port]
 *
 * The folder is heroes-capture's output (`maps\`): each map at <folder>/<id>/pack/ or, for an
 * elements render, <folder>/<id>/elements/pack/ (preferred). Default: ../heroes-capture/tmp/results/maps
 * next to this repository, port 8767. The packs are read as they are, every request: a new render
 * shows on the next reload.
 */
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const [folderArg, portArg] = process.argv.slice(2);
const folder = resolve(
  folderArg ?? join(import.meta.dirname, '..', '..', 'heroes-capture', 'tmp', 'results', 'maps'),
);
const port = Number(portArg ?? 8767);

const types: Record<string, string> = {
  '.json': 'application/json',
  '.pmtiles': 'application/octet-stream',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
};

interface Pack {
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

/** Each map's pack folder: the elements render's where there is one, else the plain one. */
async function packs(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    for (const candidate of [
      join(folder, entry.name, 'elements', 'pack'),
      join(folder, entry.name, 'pack'),
    ]) {
      const packed = await stat(join(candidate, 'pack.json')).catch(() => null);
      if (packed?.isFile()) {
        found.set(entry.name, candidate);
        break;
      }
    }
  }
  return found;
}

/** The catalog as heroes-maps writes it (its tools/catalog.mjs), from the packs found. */
async function catalog(): Promise<string> {
  const maps = [];
  for (const [id, dir] of await packs()) {
    const pack = JSON.parse(await readFile(join(dir, 'pack.json'), 'utf8')) as Pack;
    maps.push({
      id,
      name: pack.map.name,
      category: pack.map.category,
      gameBuild: pack.gameBuild,
      tool: pack.tool,
      structures: pack.map.structures,
      path: `${id}/`,
      pack: `${id}/pack.json`,
      thumbnail: pack.images.thumbnail
        ? { file: `${id}/${pack.images.thumbnail.file}`, size: pack.images.thumbnail.size }
        : null,
    });
  }
  return JSON.stringify({ format: 1, maps }, null, 2);
}

const headers = (type: string) => ({
  'content-type': type,
  'accept-ranges': 'bytes',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Range',
  'access-control-expose-headers': 'Content-Range, Content-Length',
});

async function serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers('text/plain'));
    return res.end();
  }
  if (path === '/maps/index.json') {
    const body = await catalog();
    res.writeHead(200, {
      ...headers('application/json'),
      'content-length': Buffer.byteLength(body),
    });
    return res.end(body);
  }
  const [, id, ...rest] = /^\/maps\/([^/]+)\/(.*)$/.exec(path) ?? [];
  const dir = id ? (await packs()).get(id) : undefined;
  const file = dir && rest[0] ? join(dir, rest[0]) : null;
  const info = file ? await stat(file).catch(() => null) : null;
  if (!file || !info?.isFile()) {
    res.writeHead(404, headers('text/plain'));
    return res.end('not found');
  }
  const base = headers(types[extname(file)] ?? 'application/octet-stream');
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
  const found = await packs();
  console.log(
    `serving ${found.size} map(s) from ${folder} at http://localhost:${port}/maps/ (${[...found.keys()].join(', ') || 'none yet'})`,
  );
});
