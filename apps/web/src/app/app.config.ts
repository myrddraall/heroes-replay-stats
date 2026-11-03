import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import {
  BACKGROUND_EDITOR_PATH,
  provideBackgroundFeature,
} from '@myrddraall/heroes-replay-stats-background/provide';
import { provideHeroesFeature } from '@myrddraall/heroes-replay-stats-heroes/provide';
import { provideDevFeature } from '@myrddraall/heroes-replay-stats-dev/provide';
import { provideImportFeature } from '@myrddraall/heroes-replay-stats-import/provide';
import { provideMapsFeature } from '@myrddraall/heroes-replay-stats-maps/provide';
import { providePlayersFeature } from '@myrddraall/heroes-replay-stats-players/provide';
import { provideReplaysFeature } from '@myrddraall/heroes-replay-stats-replays/provide';
import { DEV_REPORTS_URL } from '@myrddraall/heroes-replay-stats-platform/data';
import { providePlatformFeature } from '@myrddraall/heroes-replay-stats-platform/provide';
import { provideSettingsFeature } from '@myrddraall/heroes-replay-stats-settings/provide';
import { provideSheets } from '@myrddraall/heroes-replay-stats-sheets/provide';
import { provideThemeFeature } from '@myrddraall/heroes-replay-stats-theme/provide';
import { APP_VERSION } from './version';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

/** Whether a route is the Background page's (its editor: whatever is open in it). */
function onBackgroundPage(route: ActivatedRouteSnapshot | null): boolean {
  for (let r = route; r; r = r.firstChild)
    if (r.url[0]?.path === BACKGROUND_EDITOR_PATH) return true;
  return false;
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: DEV_REPORTS_URL, useValue: environment.devReportsUrl },
    provideBrowserGlobalErrorListeners(),
    // Before the router: the featuresets' routes come before the app's own (and their catch-all).
    provideBackgroundFeature(),
    provideDevFeature(),
    provideImportFeature(),
    provideMapsFeature({ packsUrl: environment.mapPacksUrl }),
    providePlayersFeature(),
    provideReplaysFeature(),
    provideSettingsFeature(),
    provideThemeFeature(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        // Within the Background page what is open changes in place: no fade over the whole page,
        // which takes every click while it runs (a double-click's second, the first having
        // shown what was clicked).
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (onBackgroundPage(from) && onBackgroundPage(to)) transition.skipTransition();
        },
      }),
    ),
    providePlatformFeature({ version: APP_VERSION }),
    provideHeroesFeature(),
    provideSheets({ url: environment.uiSheetsUrl }),
  ],
};
