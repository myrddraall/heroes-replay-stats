/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { NOISY_GAME_EVENTS, openReplay } from '@myrddraall/heroprotocol';
import {
  createMemoryContext,
  createRegistry,
  runAnalysers,
  TableSink,
  type NormalizedReplay,
} from '@myrddraall/heroprotocol-db';
import { normalizeReplay } from '@myrddraall/heroprotocol-db';
import { analysers } from '../src/index.js';

/**
 * Fixture replays are never committed (they carry other players' BattleTags). They
 * live in the heroprotocol checkout next to this repo (`pnpm run fetch.fixtures`
 * there), or wherever HRS_REPLAY_FIXTURES points. Without them the replay tests skip.
 */
export const LOCAL: string =
  process.env['HRS_REPLAY_FIXTURES'] ??
  join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    '..',
    'heroprotocol',
    'packages',
    'heroprotocol',
    'test',
    'fixtures',
    'local',
  );
export const GOLDEN: string = join(import.meta.dirname, 'fixtures', 'golden');
export const FIXED_NOW = '2026-01-01T00:00:00.000Z';

export function localReplays(): string[] {
  if (!existsSync(LOCAL)) return [];
  return readdirSync(LOCAL)
    .filter((f) => /\.(stormreplay|stormr)$/i.test(f))
    .sort();
}

export async function normalizeLocal(name: string): Promise<NormalizedReplay> {
  const bytes = new Uint8Array(readFileSync(join(LOCAL, name)));
  return normalizeReplay(await openReplay(bytes, { dropGameEvents: NOISY_GAME_EVENTS }), {
    now: FIXED_NOW,
  });
}

export function goldenName(replayFile: string): string {
  return replayFile.replace(/\.(stormreplay|stormr)$/i, '').toLowerCase() + '.analysis.json.gz';
}

/** Each app analyser's rows for a fixture, keyed by analyser id, then by table. */
export type Results = Record<string, Record<string, readonly object[]>>;

export function goldenFor(replayFile: string): Results | undefined {
  const file = join(GOLDEN, goldenName(replayFile));
  if (!existsSync(file)) return undefined;
  return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as Results;
}

/** Every app analyser at ingest, over the in-memory replay. */
export async function runInMemory(n: NormalizedReplay): Promise<Results> {
  const sink = new TableSink();
  const { computed } = await runAnalysers({
    registry: createRegistry(analysers),
    ctx: createMemoryContext(n, { tables: sink }),
    modes: ['ready', 'background'],
    sink,
  });
  const out: Results = {};
  for (const o of computed) {
    if (o.run.error !== null) throw new Error(`${o.run.analyserId}: ${o.run.error}`);
    out[o.run.analyserId] = o.rows;
  }
  return out;
}

/** Round every number so float noise across engines never trips a golden. */
export function stable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v,
    ),
  ) as T;
}
