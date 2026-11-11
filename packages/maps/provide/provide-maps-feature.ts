import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellSection } from '@myrddraall/heroes-replay-stats-shell/ui';
import { MAP_PACKS_URL } from '../data';
import { MAPS_ROUTES } from './routes';

export interface MapsFeatureOptions {
  /** Where the map packs are served: a catalog at `index.json`, each map's pack in its own folder. */
  readonly packsUrl: string;
}

/**
 * The maps in an app: the Maps page and each map's page, the Game Info area's Maps section. List it
 * before `provideRouter`.
 */
export function provideMapsFeature({ packsUrl }: MapsFeatureOptions): Provider[] {
  return [
    { provide: MAP_PACKS_URL, useValue: packsUrl },
    { provide: ROUTES, multi: true, useValue: MAPS_ROUTES },
    provideShellSection({ area: '/game-info', label: 'Maps', link: '/game-info/maps', order: 10 }),
  ];
}
