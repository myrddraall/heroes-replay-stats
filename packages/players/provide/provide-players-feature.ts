import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellNavItem } from '@myrddraall/heroes-replay-stats-shell/ui';
import { PLAYERS_ROUTES } from './routes';

/** The players in an app: the Players page and its nav item. List it before `provideRouter`. */
export function providePlayersFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: PLAYERS_ROUTES },
    provideShellNavItem({ path: '/players', label: 'Players', icon: 'groups', order: 20 }),
  ];
}
