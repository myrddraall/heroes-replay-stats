import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The Replays area's sections that have their own first segment under `/replays`. */
const REPLAYS_SECTIONS = new Set(['matches', 'players', 'maps', 'import']);

/** The match list's route and each match's page with its sections (`provideReplaysFeature` adds them). */
export const REPLAYS_ROUTES: Routes = [
  {
    path: 'replays/matches',
    title: 'Matches · Heroes Replay Stats',
    loadComponent: () => import('../feature/replays-page').then((m) => m.ReplaysPage),
  },
  {
    path: 'replays/matches/:replayId',
    title: 'Match · Heroes Replay Stats',
    loadComponent: () => import('../feature/replay-page').then((m) => m.ReplayPage),
    loadChildren: () => import('./replay.routes').then((m) => m.replayRoutes),
  },
  // Where they were before the Replays area: `/matches/…`, and before that `/replays/<id>/…`.
  {
    matcher: (url: UrlSegment[]) => (url[0]?.path === 'matches' ? { consumed: url } : null),
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree(['/replays/matches', ...url.slice(1).map((s) => s.path)]),
  },
  {
    matcher: (url: UrlSegment[]) =>
      url[0]?.path === 'replays' && url[1] && !REPLAYS_SECTIONS.has(url[1].path) ? { consumed: url } : null,
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree(['/replays/matches', ...url.slice(1).map((s) => s.path)]),
  },
];
