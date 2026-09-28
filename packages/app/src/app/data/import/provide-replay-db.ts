import { InjectionToken, type Provider } from '@angular/core';
import { createReplayDb, type ReplayDbClient } from '@myrddraall/heroprotocol-db/client';

/** The worker-backed replay database client: reads, and the first import slot. */
export const REPLAY_DB = new InjectionToken<ReplayDbClient>('hrs.replay-db');

/** Creates another client with its own ingest worker, for importing in parallel. */
export const REPLAY_DB_FACTORY = new InjectionToken<() => ReplayDbClient>('hrs.replay-db-factory');

/**
 * A client on the app's own ingest worker (replay.worker.ts), bundled by the Angular
 * builder. The `new Worker(new URL(...), ...)` shape is what the builder recognises, so
 * it stays inline.
 */
function createClient(): ReplayDbClient {
  return createReplayDb({
    worker: () => new Worker(new URL('./replay.worker', import.meta.url), { type: 'module' }),
  });
}

export function provideReplayDb(): Provider[] {
  return [
    { provide: REPLAY_DB, useFactory: createClient },
    { provide: REPLAY_DB_FACTORY, useValue: createClient },
  ];
}
