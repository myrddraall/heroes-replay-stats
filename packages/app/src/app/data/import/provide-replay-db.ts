import { InjectionToken, type Provider } from '@angular/core';
import { createReplayDb, type ReplayDbClient } from '@myrddraall/heroprotocol-db/client';

/** The worker-backed replay database client. */
export const REPLAY_DB = new InjectionToken<ReplayDbClient>('hrs.replay-db');

/**
 * The batteries-included ingest worker from @myrddraall/heroprotocol-analysis, served
 * from `hero-worker/` by the assets rule in angular.json. Relative, so it also resolves
 * under the desktop shell's file:// origin.
 */
export function provideReplayDb(): Provider {
  return {
    provide: REPLAY_DB,
    useFactory: () => createReplayDb({ workerUrl: 'hero-worker/worker.js' }),
  };
}
