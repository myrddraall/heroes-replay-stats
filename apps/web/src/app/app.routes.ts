import type { Routes } from '@angular/router';

/**
 * The app's own pages, which the shell frames, after the routes its domains' featuresets add (listed
 * before `provideRouter`). A route with `data: { shell: false }` fills the window on its own.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'replays' },
  {
    path: 'theme-preview',
    title: 'Theme preview · Heroes Replay Stats',
    loadComponent: () =>
      import('./pages/theme-preview/theme-preview-page').then((m) => m.ThemePreviewPage),
  },
  { path: '**', redirectTo: 'replays' },
];
