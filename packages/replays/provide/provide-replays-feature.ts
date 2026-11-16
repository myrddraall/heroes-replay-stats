import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellSection } from '@myrddraall/heroes-replay-stats-shell/ui';
import { REPLAYS_ROUTES } from './routes';

/**
 * The replays in an app, as matches: the match list, each match's page and the Replays area's
 * Matches section. List it before `provideRouter`.
 */
export function provideReplaysFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: REPLAYS_ROUTES },
    provideShellSection({ area: '/replays', label: 'Matches', link: '/replays/matches', order: 10 }),
  ];
}
