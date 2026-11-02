import type { Routes } from '@angular/router';

/** The replay list's route (`provideReplaysFeature` adds it). */
export const REPLAYS_ROUTES: Routes = [
  {
    path: 'replays',
    title: 'Replays · Heroes Replay Stats',
    loadComponent: () => import('../feature/replays-page').then((m) => m.ReplaysPage),
  },
];
