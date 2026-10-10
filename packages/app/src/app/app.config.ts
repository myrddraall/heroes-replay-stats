import { MAP_PACKS_URL } from '@myrddraall/heroes-replay-stats-map';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHeroData } from './data/heroes/hero-data';
import { provideReplayDb } from './data/import/provide-replay-db';
import { providePlatform } from './platform/provide-platform';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: MAP_PACKS_URL, useValue: environment.mapPacksUrl },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    providePlatform(),
    provideReplayDb(),
    provideHeroData(),
  ],
};
