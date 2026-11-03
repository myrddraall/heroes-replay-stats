import type { Routes } from '@angular/router';

/** The Maps page's route and each map's page (`provideMapsFeature` adds them). */
export const MAPS_ROUTES: Routes = [
  {
    path: 'maps',
    title: 'Maps · Heroes Replay Stats',
    loadComponent: () => import('../feature/maps-page').then((m) => m.MapsPage),
  },
  {
    path: 'maps/:mapId',
    title: 'Map · Heroes Replay Stats',
    loadComponent: () => import('../feature/map-page').then((m) => m.MapPage),
  },
];
