import type { Routes } from '@angular/router';

/** The Players page's route (`providePlayersFeature` adds it). */
export const PLAYERS_ROUTES: Routes = [
  {
    path: 'players',
    title: 'Players · Heroes Replay Stats',
    loadComponent: () => import('../feature/players-page').then((m) => m.PlayersPage),
  },
];
