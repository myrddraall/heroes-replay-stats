import type { Routes } from '@angular/router';

/** The theme preview's route (`provideBackgroundFeature` adds it). */
export const BACKGROUND_ROUTES: Routes = [
  {
    path: 'theme-preview',
    title: 'Theme preview · Heroes Replay Stats',
    loadComponent: () =>
      import('../feature/theme-preview-page').then((m) => m.ThemePreviewPage),
  },
];
