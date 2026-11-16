/**
 * The interface sheets built on this machine, served the way heroes-assets publishes its
 * channel's ones, for the app's `local` configuration (apps/web/tools/ng.ts): each sheet at
 * /ui/<sheet>.webp, with CORS and never cached, so a new build shows on the next reload.
 *
 *   pnpm run serve.sheets [folder] [port]
 *
 * The folder is a heroes-assets build's ui/ (its tools/build-channel.ts writes <channel>/ui/). By
 * default ../heroes-assets/live/ui next to this repository, on port 4210.
 */
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join, resolve } from 'node:path';

const [folderArg, portArg] = process.argv.slice(2);
const folder = resolve(
  folderArg ?? join(import.meta.dirname, '..', '..', 'heroes-assets', 'live', 'ui'),
);
const port = Number(portArg ?? 4210);

const headers = (type: string) => ({
  'content-type': type,
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
});

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const [, name] = /^\/ui\/([^/]+\.webp)$/.exec(path) ?? [];
  const file = name ? join(folder, basename(name)) : null;
  const info = file ? await stat(file).catch(() => null) : null;
  if (!file || !info?.isFile()) {
    res.writeHead(404, headers('text/plain'));
    res.end('not found');
    return;
  }
  res.writeHead(200, { ...headers('image/webp'), 'content-length': info.size });
  createReadStream(file).pipe(res);
}).listen(port, async () => {
  const sheets = (await readdir(folder).catch(() => [])).filter((n) => n.endsWith('.webp'));
  console.log(
    `serving ${sheets.length} sheet(s) from ${folder} at http://localhost:${port}/ui/: ${sheets.join(', ') || 'none yet'}`,
  );
});
