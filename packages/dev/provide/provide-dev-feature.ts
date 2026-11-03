import {
  type EnvironmentProviders,
  inject,
  Injector,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  runInInjectionContext,
} from '@angular/core';
import { ROUTES } from '@angular/router';
import { DEV_REPORTS_URL } from '@myrddraall/heroes-replay-stats-platform/data';
import { provideShellMenuItem } from '@myrddraall/heroes-replay-stats-shell/ui';
import { DEV_ROUTES } from './routes';

/**
 * The developer tools in an app: the renderer check's page (in the settings menu's Dev group), and, where dev reports go, the
 * background's frame stats while they show (loaded only then: the stats come with the
 * background's renderer, which the first page doesn't wait for). List it before `provideRouter`.
 */
export function provideDevFeature(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ROUTES, multi: true, useValue: DEV_ROUTES },
    provideShellMenuItem({ label: 'Renderer check', link: '/renderer-check', order: 30, group: 'dev' }),
    provideEnvironmentInitializer(() => {
      if (!inject(DEV_REPORTS_URL)) return;
      const injector = inject(Injector);
      void import('../data').then((m) => runInInjectionContext(injector, m.reportFrameStats));
    }),
  ]);
}
