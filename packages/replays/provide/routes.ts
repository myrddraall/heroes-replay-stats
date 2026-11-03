import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The match list's route and each match's page with its sections (`provideReplaysFeature` adds them). */
export const REPLAYS_ROUTES: Routes = [
  {
    path: 'matches',
    title: 'Matches · Heroes Replay Stats',
    loadComponent: () => import('../feature/replays-page').then((m) => m.ReplaysPage),
  },
  {
    path: 'matches/:replayId',
    title: 'Match · Heroes Replay Stats',
    loadComponent: () => import('../feature/replay-page').then((m) => m.ReplayPage),
    loadChildren: () => import('./replay.routes').then((m) => m.replayRoutes),
  },
  // Where they were before they were matches: the same pages, whatever under them was asked for.
  {
    matcher: (url: UrlSegment[]) => (url[0]?.path === 'replays' ? { consumed: url } : null),
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree(['/matches', ...url.slice(1).map((s) => s.path)]),
  },
];
