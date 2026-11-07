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
import {
  provideShellArea,
  provideShellMenuItem,
  provideShellSection,
} from '@myrddraall/heroes-replay-stats-shell/ui';
import { DEV_ROUTES } from './routes';

/**
 * The developer tools in an app: the UI area (in the settings menu's Dev group: the theme, the
 * components, the tests), the renderer check's page (there too), and, where dev reports go, the
 * background's frame stats while they show (loaded only then: the stats come with the
 * background's renderer, which the first page doesn't wait for). List it before `provideRouter`.
 */
export function provideDevFeature(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ROUTES, multi: true, useValue: DEV_ROUTES },
    // UI: the site's interface for its developers (the theme, components, tests), from the
    // settings menu's Dev group only; the background's feature adds its Theme section
    provideShellArea({ path: '/ui', label: 'UI', order: 90, hidden: true }),
    provideShellMenuItem({ label: 'UI', link: '/ui', order: 10, group: 'dev' }),
    provideShellSection({
      area: '/ui',
      label: 'Components',
      link: '/ui/components',
      order: 20,
      children: [
        {
          label: 'Frames',
          link: '/ui/components/frames',
          children: [
            { label: 'Hero frame', link: '/ui/components/frames/hero' },
            { label: 'Talent frame', link: '/ui/components/frames/talent' },
          ],
        },
        {
          label: 'Tooltips',
          link: '/ui/components/tooltips',
          children: [
            { label: 'Standard tooltip', link: '/ui/components/tooltips/standard' },
            { label: 'Talent tooltip', link: '/ui/components/tooltips/talent' },
          ],
        },
      ],
    }),
    provideShellSection({
      area: '/ui',
      label: 'Tests',
      link: '/ui/tests',
      order: 30,
      children: [{ label: 'Lists', link: '/ui/tests/lists' }],
    }),
    provideShellMenuItem({ label: 'Renderer check', link: '/renderer-check', order: 30, group: 'dev' }),
    provideEnvironmentInitializer(() => {
      if (!inject(DEV_REPORTS_URL)) return;
      const injector = inject(Injector);
      void import('../data').then((m) => runInInjectionContext(injector, m.reportFrameStats));
    }),
  ]);
}
