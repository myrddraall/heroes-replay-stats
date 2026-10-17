/**
 * `ng` with the `local` configuration added where DEV_LOCAL is true (the devcontainer sets it):
 * the app then reads the maps rendered on this machine (`pnpm run serve.maps`, through the dev
 * server's proxy) instead of the ones heroes-maps publishes. Anywhere else (CI, a release build)
 * `ng` runs as it is, so nothing changes at check-in. `node tools/ng.mts build|serve [args]`; a
 * `--configuration` given is kept, with `local` added to it (`pnpm start -- --configuration
 * production` serves the production bundle with the local maps).
 */
import { spawnSync } from 'node:child_process';

const [command, ...rest] = process.argv.slice(2);
const args = [command ?? '', ...rest];
if (process.env['DEV_LOCAL'] === 'true' && (command === 'build' || command === 'serve')) {
  const at = args.findIndex((a) => a === '--configuration' || a === '-c' || a.startsWith('--configuration='));
  if (at < 0) args.push('--configuration', command === 'build' ? 'production,local' : 'development,local');
  else if (args[at]?.includes('=')) args[at] += ',local';
  else args[at + 1] += ',local';
}
const result = spawnSync('ng', args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
