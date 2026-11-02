import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellNavItem } from '@myrddraall/heroes-replay-stats-shell/ui';
import { REPLAYS_ROUTES } from './routes';

/** The replays in an app: the replay list and its nav item. List it before `provideRouter`. */
export function provideReplaysFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: REPLAYS_ROUTES },
    provideShellNavItem({ path: '/replays', label: 'Replays', icon: 'history', order: 10 }),
  ];
}
