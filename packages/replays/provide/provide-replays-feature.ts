import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellArea } from '@myrddraall/heroes-replay-stats-shell/ui';
import { REPLAYS_ROUTES } from './routes';

/**
 * The replays in an app, as matches: the match list, each match's page and the Matches area. List
 * it before `provideRouter`.
 */
export function provideReplaysFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: REPLAYS_ROUTES },
    provideShellArea({ path: '/matches', label: 'Matches', family: 'matches', order: 10 }),
  ];
}
