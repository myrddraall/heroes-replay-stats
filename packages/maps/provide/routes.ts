import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The Maps page's route and each map's page, in the Game area (`provideMapsFeature` adds them). */
export const MAPS_ROUTES: Routes = [
  {
    path: 'game/maps',
    title: 'Maps · Heroes Replay Stats',
    loadComponent: () => import('../feature/maps-page').then((m) => m.MapsPage),
  },
  {
    path: 'game/maps/:mapId',
    title: 'Map · Heroes Replay Stats',
    loadComponent: () => import('../feature/map-page').then((m) => m.MapPage),
  },
  // Where they were before the Game area: the same pages.
  {
    matcher: (url: UrlSegment[]) => (url[0]?.path === 'maps' ? { consumed: url } : null),
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree(['/game/maps', ...url.slice(1).map((s) => s.path)]),
  },
];
