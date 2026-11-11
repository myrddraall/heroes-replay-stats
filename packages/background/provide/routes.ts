import type { Routes } from '@angular/router';

/** The theme preview's route, the UI area's Theme (`provideBackgroundFeature` adds it). */
export const BACKGROUND_ROUTES: Routes = [
  {
    path: 'ui/theme',
    title: 'Theme · UI · Heroes Replay Stats',
    loadComponent: () =>
      import('../feature/theme-preview-page').then((m) => m.ThemePreviewPage),
  },
  { path: 'theme-preview', redirectTo: 'ui/theme' },
];
