import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The Players page's route (`providePlayersFeature` adds it). */
export const PLAYERS_ROUTES: Routes = [
  {
    path: 'replays/players',
    title: 'Players · Heroes Replay Stats',
    loadComponent: () => import('../feature/players-page').then((m) => m.PlayersPage),
  },
  // Where it was before the Replays area.
  {
    matcher: (url: UrlSegment[]) => (url[0]?.path === 'players' ? { consumed: url } : null),
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree(['/replays/players', ...url.slice(1).map((s) => s.path)]),
  },
];
