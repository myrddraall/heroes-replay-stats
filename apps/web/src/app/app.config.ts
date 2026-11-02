import { inject, type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAether } from '@myrddraall/heroes-replay-stats-aether';
import { provideAetherForge } from '@myrddraall/heroes-replay-stats-aether-forge';
import { MAP_PACKS_URL } from '@myrddraall/heroes-replay-stats-map';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideHeroesFeature } from '@myrddraall/heroes-replay-stats-heroes/provide';
import { GraphicsStore } from './data/settings/graphics.store';
import { provideImportFeature } from '@myrddraall/heroes-replay-stats-import/provide';
import { providePlayersFeature } from '@myrddraall/heroes-replay-stats-players/provide';
import { DEV_REPORTS_URL } from '@myrddraall/heroes-replay-stats-platform/data';
import { providePlatformFeature } from '@myrddraall/heroes-replay-stats-platform/provide';
import { provideSettingsFeature } from '@myrddraall/heroes-replay-stats-settings/provide';
import { provideSettingsSection } from '@myrddraall/heroes-replay-stats-settings/ui';
import { APP_VERSION } from './version';
import { BACKGROUND_EDITOR, BACKGROUND_EDITOR_PATH } from './site-background/background-editor';
import { provideSiteBackground } from './site-background/provide-site-background';
import { PRESETS } from './site-background/tint-presets';
import { routes } from './app.routes';
import { provideAppShellSlots } from './shell-slots';
import { environment } from '../environments/environment';

/** Whether a route is the Background page's (its editor: whatever is open in it). */
function onBackgroundPage(route: ActivatedRouteSnapshot | null): boolean {
  for (let r = route; r; r = r.firstChild)
    if (r.url[0]?.path === BACKGROUND_EDITOR_PATH) return true;
  return false;
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: MAP_PACKS_URL, useValue: environment.mapPacksUrl },
    { provide: DEV_REPORTS_URL, useValue: environment.devReportsUrl },
    provideBrowserGlobalErrorListeners(),
    provideAether({
      dataUrl: 'backgrounds/play/',
      storage: { keyPrefix: 'hrs.background-', databasePrefix: 'hrs-background-' },
      renderApi: () => inject(GraphicsStore).api,
      tintPresets: PRESETS,
    }),
    // Before the router: the featuresets' routes come before the app's own (and their catch-all).
    provideAetherForge(BACKGROUND_EDITOR),
    provideImportFeature(),
    providePlayersFeature(),
    provideSettingsFeature(),
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
    provideSiteBackground(),
    // The background's settings, until the background domain adds them itself.
    provideSettingsSection({
      id: 'graphics',
      order: 10,
      load: () =>
        import('./site-background/graphics-section/graphics-section').then(
          (m) => m.GraphicsSection,
        ),
    }),
    provideAppShellSlots(),
  ],
};
