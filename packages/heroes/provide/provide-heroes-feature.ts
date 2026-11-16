import type { Provider } from '@angular/core';
import { cachedHeroData, HERO_DATA } from '../data';

/** Hero data for the app: each build's own from heroes-assets, cached in the browser. */
export function provideHeroesFeature(): Provider[] {
  return [{ provide: HERO_DATA, useFactory: cachedHeroData }];
}
