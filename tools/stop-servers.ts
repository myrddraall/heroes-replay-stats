/**
 * Stops this repository's running dev servers (`ng serve`, as `pnpm start` runs it, and the
 * wrappers that started it) and the local servers its proxy reaches (`serve.maps`, `serve.reports`,
 * `serve.sheets`, which `pnpm start` runs alongside), wherever they were started from (another
 * terminal, another session), so `pnpm restart` (pnpm runs `stop`, then `start`) always comes up
 * on fresh ones.
 *
 *   pnpm stop [port]
 *
 * With a port, only the dev server serving it (`--port`, else 4200, `ng serve`'s default); its
 * wrapper stops the local servers it started. Finds them through /proc (Linux: the devcontainer);
 * asks each to stop, and ends any still running after a few seconds.
 */
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const portArg = process.argv[2];
const onlyPort = portArg === undefined ? null : Number(portArg);
/** A dev server's processes: `ng serve` itself, and the `node tools/ng.mts serve` that started it. */
const SERVER = /(^|\s|\/)(ng(\.mts)?)\s+serve(\s|$)/;
/** The local servers the dev server's proxy reaches (tools/serve-*.ts). */
const LOCAL_SERVER = /(^|\s|\/)tools\/serve-(maps|reports|sheets)\.ts(\s|$)/;

/** Their ports (apps/web/proxy.local.json), for the log. */
const LOCAL_PORTS: Record<string, number> = { maps: 4208, reports: 4209, sheets: 4210 };

interface Found {
  readonly pid: number;
  readonly command: string;
  readonly port: number;
}

function servers(): Found[] {
  const found: Found[] = [];
  for (const entry of readdirSync('/proc')) {
    const pid = Number(entry);
    if (!Number.isInteger(pid) || pid === process.pid) continue;
    try {
      const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim();
      const local = LOCAL_SERVER.exec(command);
      if (!SERVER.test(command) && !local) continue;
      const cwd = readlinkSync(`/proc/${pid}/cwd`);
      if (cwd !== root && !cwd.startsWith(root + sep)) continue;
      if (local) {
        if (onlyPort === null) found.push({ pid, command, port: LOCAL_PORTS[local[2]!]! });
        continue;
      }
      const port = Number(/--port[=\s]+(\d+)/.exec(command)?.[1] ?? 4200);
      if (onlyPort === null || port === onlyPort) found.push({ pid, command, port });
    } catch {
      // gone, or not ours to read
    }
  }
  return found;
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const running = servers();
if (!running.length) {
  console.log(`no dev server running${onlyPort === null ? '' : ` on port ${onlyPort}`}`);
} else {
  for (const { pid, command, port } of running) {
    console.log(`stopping ${pid} (port ${port}): ${command}`);
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  const until = Date.now() + 5000;
  while (running.some(({ pid }) => alive(pid)) && Date.now() < until)
    await new Promise((r) => setTimeout(r, 100));
  for (const { pid } of running.filter(({ pid }) => alive(pid))) {
    console.log(`ending ${pid}, still running`);
    process.kill(pid, 'SIGKILL');
  }
}
