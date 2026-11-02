import type { Routes } from '@angular/router';

/** The Import page's route (`provideImportFeature` adds it). */
export const IMPORT_ROUTES: Routes = [
  {
    path: 'import',
    title: 'Import · Heroes Replay Stats',
    loadComponent: () => import('../feature/import-page').then((m) => m.ImportPage),
  },
];
