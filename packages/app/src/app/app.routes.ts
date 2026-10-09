import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'replays' },
  {
    path: 'replays',
    title: 'Replays · Heroes Replay Stats',
    loadComponent: () => import('./pages/replays/replays-page').then((m) => m.ReplaysPage),
  },
  {
    path: 'players',
    title: 'Players · Heroes Replay Stats',
    loadComponent: () => import('./pages/players/players-page').then((m) => m.PlayersPage),
  },
  {
    path: 'maps',
    title: 'Maps · Heroes Replay Stats',
    loadComponent: () => import('./pages/maps/maps-page').then((m) => m.MapsPage),
  },
  {
    path: 'maps/:mapId',
    title: 'Map · Heroes Replay Stats',
    loadComponent: () => import('./pages/maps/map-page').then((m) => m.MapPage),
  },
  {
    path: 'import',
    title: 'Import · Heroes Replay Stats',
    loadComponent: () => import('./pages/import/import-page').then((m) => m.ImportPage),
  },
  {
    path: 'settings',
    title: 'Settings · Heroes Replay Stats',
    loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'replays' },
];
