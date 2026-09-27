import { InjectionToken, type Provider } from '@angular/core';
import { createReplayDb, type ReplayDbClient } from '@myrddraall/heroprotocol-db/client';

/** The worker-backed replay database client. */
export const REPLAY_DB = new InjectionToken<ReplayDbClient>('hrs.replay-db');

/**
 * The app's own ingest worker (replay.worker.ts), bundled by the Angular builder. The
 * `new Worker(new URL(...), ...)` shape is what the builder recognises, so it stays inline.
 */
export function provideReplayDb(): Provider {
  return {
    provide: REPLAY_DB,
    useFactory: () =>
      createReplayDb({
        worker: () => new Worker(new URL('./replay.worker', import.meta.url), { type: 'module' }),
      }),
  };
}
