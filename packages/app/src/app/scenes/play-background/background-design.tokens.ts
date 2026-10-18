import { inject, InjectionToken } from '@angular/core';
import type { BackgroundDesign, BackgroundSceneSource } from './background-design';
import { PublishedDesignStore } from './published-design.store';

/**
 * The design in effect for what is under it: the published design by default (what the site
 * shows), and under the Background page its draft, which the page provides in its place, so what
 * is shown and edited there is the draft while the rest of the site shows what is published.
 */
export const BACKGROUND_DESIGN = new InjectionToken<BackgroundDesign>('BACKGROUND_DESIGN', {
  providedIn: 'root',
  factory: () => {
    const published = inject(PublishedDesignStore);
    return { library: published.library, scenes: published.scenes };
  },
});

/**
 * A scene to show in place of the site's random sets, for the background under whatever provides
 * it (an editor's scene); none provided: the random sets.
 */
export const BACKGROUND_SCENE = new InjectionToken<BackgroundSceneSource>('BACKGROUND_SCENE');
