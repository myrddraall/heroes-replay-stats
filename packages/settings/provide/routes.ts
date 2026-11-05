import type { Routes } from '@angular/router';

/** The Settings and About pages' routes (`provideSettingsFeature` adds them). */
export const SETTINGS_ROUTES: Routes = [
  {
    path: 'settings',
    title: 'Settings · Heroes Replay Stats',
    loadComponent: () => import('../feature').then((m) => m.SettingsPage),
  },
  {
    path: 'about',
    title: 'About · Heroes Replay Stats',
    loadComponent: () => import('../feature').then((m) => m.AboutPage),
  },
];
