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
    path: 'theme-preview',
    title: 'Theme preview · Heroes Replay Stats',
    loadComponent: () =>
      import('./pages/theme-preview/theme-preview-page').then((m) => m.ThemePreviewPage),
  },
  { path: '**', redirectTo: 'replays' },
];
