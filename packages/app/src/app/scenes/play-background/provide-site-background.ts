import { DOCUMENT } from '@angular/common';
import {
  effect,
  type EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
  untracked,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { GraphicsStore } from '../../data/settings/graphics.store';
import { BackgroundStore } from './background.store';
import { presetById, PRESETS, presetTints } from './tint-presets';

/** The page a URL is of: its path, without the query or the fragment. */
function pageOf(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

/**
 * The site's background follows the Graphics settings: how it is drawn, and its colour. The site
 * loads untinted; a fixed colour fades in, and a random one or the next in turn comes with each
 * page after the first. Each new page asks for a new picture (drawn when the background doesn't
 * move).
 */
export function provideSiteBackground(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const graphics = inject(GraphicsStore);
    const background = inject(BackgroundStore);
    const root = inject(DOCUMENT).documentElement;
    /** The preset the site's background is in, by its place in PRESETS (0: untinted). */
    let shown = 0;
    const show = (index: number) => {
      shown = index;
      background.setTints(presetTints(PRESETS[index]!, root));
    };

    effect(() =>
      background.setDrawing({
        animate: graphics.animate(),
        idleFps: graphics.idleFps(),
        animationFps: graphics.animationFps(),
        interactingFps: graphics.interactingFps(),
        resolution: graphics.resolution(),
      }),
    );
    effect(() => {
      if (graphics.colourMode() !== 'fixed') return;
      const index = PRESETS.indexOf(presetById(graphics.colour()));
      untracked(() => show(index));
    });

    let page: string | undefined;
    inject(Router)
      .events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const now = pageOf(e.urlAfterRedirects);
        const first = page === undefined;
        if (now === page) return;
        page = now;
        if (first) return; // the site loads as it is
        const mode = untracked(graphics.colourMode);
        if (mode === 'in-turn') show((shown + 1) % PRESETS.length);
        else if (mode === 'random') {
          // Any other than the one shown.
          show((shown + 1 + Math.floor(Math.random() * (PRESETS.length - 1))) % PRESETS.length);
        }
        background.newPicture();
      });
  });
}
