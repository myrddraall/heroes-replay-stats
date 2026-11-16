import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellSection } from '@myrddraall/heroes-replay-stats-shell/ui';
import { PLAYERS_ROUTES } from './routes';

/** The players in an app: the Players page (a section of the Replays area) and each player's page. List it before `provideRouter`. */
export function providePlayersFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: PLAYERS_ROUTES },
    provideShellSection({ area: '/replays', label: 'Players', link: '/replays/players', order: 20 }),
  ];
}
