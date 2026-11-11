import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The Players page's route and each player's page with its sections (`providePlayersFeature` adds them). */
export const PLAYERS_ROUTES: Routes = [
  {
    path: 'replays/players',
    title: 'Players · Heroes Replay Stats',
    loadComponent: () => import('../feature/players-page').then((m) => m.PlayersPage),
  },
  {
    path: 'replays/players/:playerId',
    title: 'Player · Heroes Replay Stats',
    loadComponent: () => import('../feature/player-page').then((m) => m.PlayerPage),
    loadChildren: () => import('./player.routes').then((m) => m.playerRoutes),
  },
  // Where it was before the Replays area.
  {
    matcher: (url: UrlSegment[]) => (url[0]?.path === 'players' ? { consumed: url } : null),
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree(['/replays/players', ...url.slice(1).map((s) => s.path)]),
  },
];
