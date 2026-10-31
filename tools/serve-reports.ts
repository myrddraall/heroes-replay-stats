/**
 * Reports a page in the app sends from a browser anywhere (the renderer check's results), kept in
 * this repository's tmp/dev-reports/ so they can be read here: the app's `local` configuration
 * sends them to its dev server's /dev-reports/ (proxy.local.json), which passes them on to this.
 *
 *   pnpm run serve.reports [port]
 *
 * POST /dev-reports/<name> keeps the body as <name>.txt (the latest), and with `?keep` also as
 * <name>-<time>.txt (a finished report, kept after the next); GET /dev-reports/<name> gives the
 * latest back. Port 4209 by default.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

const port = Number(process.argv[2] ?? 4209);
const folder = join(import.meta.dirname, '..', 'tmp', 'dev-reports');
/** A report's name: letters, digits, dots, dashes and underscores only (it names a file). */
const NAME = /^\/dev-reports\/([\w.-]+)$/;
/** The most a report may be (the renderer check's are tens of kB). */
const MAX_BYTES = 16 * 1024 * 1024;

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const name = NAME.exec(url.pathname)?.[1];
  const keep = url.searchParams.has('keep');
  if (!name) {
    res.writeHead(404).end('not a report');
    return;
  }
  if (req.method === 'GET') {
    readFile(join(folder, `${name}.txt`)).then(
      (body) => res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(body),
      () => res.writeHead(404).end('no such report yet'),
    );
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BYTES) req.destroy();
    else chunks.push(chunk);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    void mkdir(folder, { recursive: true })
      .then(() =>
        Promise.all([
          writeFile(join(folder, `${name}.txt`), body),
          keep ? writeFile(join(folder, `${name}-${time}.txt`), body) : undefined,
        ]),
      )
      .then(
        () => {
          console.log(`${time} ${name}: ${body.length} bytes${keep ? ', kept' : ''}`);
          res.writeHead(204).end();
        },
        (error: unknown) => res.writeHead(500).end(String(error)),
      );
  });
}).listen(port, () =>
  console.log(`keeping reports in ${folder}, at http://localhost:${port}/dev-reports/`),
);
