/**
 * `ng` with the `local` configuration added where DEV_LOCAL is true (the devcontainer sets it):
 * the app then reads the maps rendered on this machine and the interface sheets built here, and
 * sends its reports here, through the dev server's proxy (proxy.local.json). Anywhere else (CI, a
 * release build) `ng` runs as it is, so nothing changes at check-in. `node tools/ng.mts
 * build|serve [args]`; a `--configuration` given is kept, with `local` added to it (`pnpm start --
 * --configuration production` serves the production bundle with the local maps).
 *
 * Serving locally, it also runs the servers that proxy reaches (the repository's `serve.maps`,
 * `serve.reports` and `serve.sheets`), each unless something already answers on its port, and
 * stops them when `ng serve` ends; `pnpm stop` stops them too.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..', '..');
/** The servers the `local` configuration's proxy reaches, and their ports (proxy.local.json). */
const LOCAL_SERVERS = [
  { name: 'maps', script: 'serve-maps.ts', port: 4208 },
  { name: 'reports', script: 'serve-reports.ts', port: 4209 },
  { name: 'sheets', script: 'serve-sheets.ts', port: 4210 },
] as const;

const [command, ...rest] = process.argv.slice(2);
const args = [command ?? '', ...rest];
const local = process.env['DEV_LOCAL'] === 'true';
if (local && (command === 'build' || command === 'serve')) {
  const at = args.findIndex(
    (a) => a === '--configuration' || a === '-c' || a.startsWith('--configuration='),
  );
  if (at < 0)
    args.push('--configuration', command === 'build' ? 'production,local' : 'development,local');
  else if (args[at]?.includes('=')) args[at] += ',local';
  else args[at + 1] += ',local';
}

/** Whether something already answers on the port (a server started by hand, say). */
const inUse = (port: number) =>
  new Promise<boolean>((done) => {
    const socket = connect(port, 'localhost');
    socket.once('connect', () => (socket.destroy(), done(true)));
    socket.once('error', () => done(false));
  });

const helpers: ChildProcess[] = [];
if (local && command === 'serve') {
  for (const { name, script, port } of LOCAL_SERVERS) {
    if (await inUse(port)) {
      console.log(`[${name}] port ${port} already answers; using that`);
      continue;
    }
    helpers.push(
      spawn(process.execPath, [join(root, 'tools', script)], { cwd: root, stdio: 'inherit' }),
    );
  }
}
const stopHelpers = () => {
  for (const helper of helpers) if (helper.exitCode === null) helper.kill('SIGTERM');
};

const ng = spawn('ng', args, { stdio: 'inherit', shell: process.platform === 'win32' });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    stopHelpers();
    ng.kill(signal);
  });
}
ng.on('exit', (code, signal) => {
  stopHelpers();
  process.exit(code ?? (signal ? 1 : 0));
});
