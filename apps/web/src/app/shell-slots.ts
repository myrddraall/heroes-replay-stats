import { inject, type Provider } from '@angular/core';
import {
  provideShellBackdrop,
  provideShellLook,
  provideShellNavItem,
  type ShellNavItem,
} from '@myrddraall/heroes-replay-stats-shell/ui';
import { GraphicsStore } from './data/settings/graphics.store';
import { BACKGROUND_EDITOR_PATH } from './site-background/background-editor';

/** The shell's nav items for the pages still in the app (each domain adds its own once it moves out). */
export const APP_NAV_ITEMS: readonly ShellNavItem[] = [
  { path: '/theme-preview', label: 'Theme preview', icon: 'palette', order: 50 },
  { path: `/${BACKGROUND_EDITOR_PATH}`, label: 'Background', icon: 'wallpaper', order: 60 },
];

/**
 * What the shell shows of the parts still in the app: their nav items, the site's background
 * behind the pages, and the glass's look from the Graphics settings. Each moves to its domain's featureset as the domain moves out of the app.
 */
export function provideAppShellSlots(): Provider[] {
  return [
    ...APP_NAV_ITEMS.map((item) => provideShellNavItem(item)),
    provideShellBackdrop(() =>
      import('./site-background/site-backdrop').then((m) => m.SiteBackdrop),
    ),
    provideShellLook(() => {
      const graphics = inject(GraphicsStore);
      return {
        theme: graphics.theme,
        glassAlpha: graphics.glassAlpha,
        frameAlpha: graphics.frameAlpha,
        blur: graphics.blur,
      };
    }),
  ];
}
