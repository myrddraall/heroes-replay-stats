import type { Routes } from '@angular/router';

/**
 * The app's own pages, which the shell frames, after the routes its domains' featuresets add (listed
 * before `provideRouter`). A route with `data: { shell: false }` fills the window on its own.
 */
export const routes: Routes = [
  // Both renderers drawing the site's background at once, their pictures compared.
  {
    path: 'renderer-check',
    title: 'Renderer check · Heroes Replay Stats',
    data: { shell: false },
    loadComponent: () =>
      import('./pages/renderer-check/renderer-check-page').then((m) => m.RendererCheckPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'replays' },
  {
    path: 'replays',
    title: 'Replays · Heroes Replay Stats',
    loadComponent: () => import('./pages/replays/replays-page').then((m) => m.ReplaysPage),
  },
  {
    path: 'replays/:replayId',
    title: 'Replay · Heroes Replay Stats',
    loadComponent: () => import('./pages/replay/replay-page').then((m) => m.ReplayPage),
    loadChildren: () => import('./pages/replay/replay.routes').then((m) => m.replayRoutes),
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
    path: 'theme-preview',
    title: 'Theme preview · Heroes Replay Stats',
    loadComponent: () =>
      import('./pages/theme-preview/theme-preview-page').then((m) => m.ThemePreviewPage),
  },
  { path: '**', redirectTo: 'replays' },
];
