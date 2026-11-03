import type { Provider } from '@angular/core';
import {
  provideShellBackdrop,
  provideShellNavItem,
  type ShellNavItem,
} from '@myrddraall/heroes-replay-stats-shell/ui';
import { BACKGROUND_EDITOR_PATH } from './site-background/background-editor';

/** The shell's nav items for the pages still in the app (each domain adds its own once it moves out). */
export const APP_NAV_ITEMS: readonly ShellNavItem[] = [
  { path: '/theme-preview', label: 'Theme preview', icon: 'palette', order: 50 },
  { path: `/${BACKGROUND_EDITOR_PATH}`, label: 'Background', icon: 'wallpaper', order: 60 },
];

/**
 * What the shell shows of the parts still in the app: their nav items and the site's background
 * behind the pages. Each moves to its domain's featureset as the domain moves out of the app.
 */
export function provideAppShellSlots(): Provider[] {
  return [
    ...APP_NAV_ITEMS.map((item) => provideShellNavItem(item)),
    provideShellBackdrop(() =>
      import('./site-background/site-backdrop').then((m) => m.SiteBackdrop),
    ),
  ];
}
