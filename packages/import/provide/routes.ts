import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The Import page's route, in the Replays area (`provideImportFeature` adds it). */
export const IMPORT_ROUTES: Routes = [
  {
    path: 'replays/import',
    title: 'Import · Heroes Replay Stats',
    loadComponent: () => import('../feature/import-page').then((m) => m.ImportPage),
  },
  // Where it was before the Replays area.
  {
    matcher: (url: UrlSegment[]) => (url[0]?.path === 'import' ? { consumed: url } : null),
    redirectTo: () => inject(Router).createUrlTree(['/replays/import']),
  },
];
