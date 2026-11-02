import { inject, type Provider } from '@angular/core';
import {
  provideShellBackdrop,
  provideShellFileDrop,
  provideShellLook,
  provideShellNavItem,
  provideShellToolbarAction,
  type ShellNavItem,
} from '@myrddraall/heroes-replay-stats-shell/ui';
import { ReplayImportJobStore } from './data/import/replay-import-job.store';
import { GraphicsStore } from './data/settings/graphics.store';
import { ImportToolbarAction } from './pages/import/import-toolbar-action/import-toolbar-action';
import { BACKGROUND_EDITOR_PATH } from './site-background/background-editor';

/** The shell's nav items for the pages still in the app (each domain adds its own once it moves out). */
export const APP_NAV_ITEMS: readonly ShellNavItem[] = [
  { path: '/replays', label: 'Replays', icon: 'history', order: 10 },
  { path: '/players', label: 'Players', icon: 'groups', order: 20 },
  { path: '/maps', label: 'Maps', icon: 'map', order: 30 },
  { path: '/import', label: 'Import', icon: 'upload_file', order: 40 },
  { path: '/theme-preview', label: 'Theme preview', icon: 'palette', order: 50 },
  { path: `/${BACKGROUND_EDITOR_PATH}`, label: 'Background', icon: 'wallpaper', order: 60 },
];

/**
 * What the shell shows of the parts still in the app: their nav items, importing (the toolbar's
 * action and dropped files), the site's background behind the pages, and the glass's look from the
 * Graphics settings. Each moves to its domain's featureset as the domain moves out of the app.
 */
export function provideAppShellSlots(): Provider[] {
  return [
    ...APP_NAV_ITEMS.map((item) => provideShellNavItem(item)),
    provideShellToolbarAction(ImportToolbarAction),
    provideShellFileDrop(() => {
      const imports = inject(ReplayImportJobStore);
      return {
        label: 'Drop .StormReplay files to import them',
        icon: 'upload_file',
        accepts: (file) => /\.stormreplay$/i.test(file.name),
        drop: (files) => void imports.import(files),
      };
    }),
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
