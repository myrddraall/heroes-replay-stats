import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellArea } from '@myrddraall/heroes-replay-stats-shell/ui';
import { PLAYERS_ROUTES } from './routes';

/** The players in an app: the Players page and its area. List it before `provideRouter`. */
export function providePlayersFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: PLAYERS_ROUTES },
    provideShellArea({ path: '/players', label: 'Players', family: 'matches', order: 20 }),
  ];
}
