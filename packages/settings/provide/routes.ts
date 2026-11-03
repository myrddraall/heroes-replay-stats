import type { Routes } from '@angular/router';

/** The Settings page's route (`provideSettingsFeature` adds it). */
export const SETTINGS_ROUTES: Routes = [
  {
    path: 'settings',
    title: 'Settings · Heroes Replay Stats',
    loadComponent: () => import('../feature').then((m) => m.SettingsPage),
  },
];
