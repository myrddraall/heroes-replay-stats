import type { Routes } from '@angular/router';

/** The Settings page's route. Shown inside the shell (the app nests these under it for now). */
export const SETTINGS_ROUTES: Routes = [
  {
    path: 'settings',
    title: 'Settings · Heroes Replay Stats',
    loadComponent: () => import('../feature').then((m) => m.SettingsPage),
  },
];
