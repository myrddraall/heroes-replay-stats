import { Routes } from '@angular/router';
import { Shell } from './shell/shell';

/** The app's pages, in the shell (its toolbar and navigation). */
const pages: Routes = [
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
    path: 'theme-preview',
    title: 'Theme preview · Heroes Replay Stats',
    loadComponent: () =>
      import('./pages/theme-preview/theme-preview-page').then((m) => m.ThemePreviewPage),
  },
  {
    path: 'settings',
    title: 'Settings · Heroes Replay Stats',
    loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'replays' },
];

export const routes: Routes = [
  // A page of its own, filling the window without the shell.
  {
    path: 'play-background',
    title: 'Play screen background · Heroes Replay Stats',
    loadComponent: () =>
      import('./pages/play-background/play-background-page').then((m) => m.PlayBackgroundPage),
  },
  { path: '', component: Shell, children: pages },
];
