import { inject } from '@angular/core';
import { Router, type Routes, type UrlSegment } from '@angular/router';

/** The Maps page's route and each map's page, in the Game Info area (`provideMapsFeature` adds them). */
export const MAPS_ROUTES: Routes = [
  {
    path: 'game-info/maps',
    title: 'Maps · Heroes Replay Stats',
    loadComponent: () => import('../feature/maps-page').then((m) => m.MapsPage),
  },
  {
    path: 'game-info/maps/:mapId',
    title: 'Map · Heroes Replay Stats',
    loadComponent: () => import('../feature/map-page').then((m) => m.MapPage),
  },
  // Where they were before the Game Info area: `/game/maps/…`, and before that `/maps/…`.
  {
    matcher: (url: UrlSegment[]) =>
      url[0]?.path === 'maps'
        ? { consumed: url }
        : url[0]?.path === 'game' && url[1]?.path === 'maps'
          ? { consumed: url }
          : null,
    redirectTo: ({ url }) =>
      inject(Router).createUrlTree([
        '/game-info/maps',
        ...url.slice(url[0]?.path === 'game' ? 2 : 1).map((s) => s.path),
      ]),
  },
];
