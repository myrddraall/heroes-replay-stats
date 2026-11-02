import type { Routes } from '@angular/router';

/** The replay list's route and each replay's page with its sections (`provideReplaysFeature` adds them). */
export const REPLAYS_ROUTES: Routes = [
  {
    path: 'replays',
    title: 'Replays · Heroes Replay Stats',
    loadComponent: () => import('../feature/replays-page').then((m) => m.ReplaysPage),
  },
  {
    path: 'replays/:replayId',
    title: 'Replay · Heroes Replay Stats',
    loadComponent: () => import('../feature/replay-page').then((m) => m.ReplayPage),
    loadChildren: () => import('./replay.routes').then((m) => m.replayRoutes),
  },
];
