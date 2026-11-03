import { computed, inject, Injector } from '@angular/core';
import { type AetherForgeOptions } from '@myrddraall/heroes-replay-stats-aether-forge';
import { ThemeStore } from '@myrddraall/heroes-replay-stats-theme/data';

/** The background editor's URL under the app's root. */
export const BACKGROUND_EDITOR_PATH = 'edit-background';

/** The background editor in the app: its page, styled in the site's theme. */
export const BACKGROUND_EDITOR: AetherForgeOptions = {
  path: BACKGROUND_EDITOR_PATH,
  title: 'Play screen background · Heroes Replay Stats',
  routeData: { shell: false },
  panelClass: () => {
    const theme = inject(ThemeStore);
    return computed(() => `hrs-glass-${theme.theme()}`);
  },
  openSettings: () => {
    const injector = inject(Injector);
    // The settings, in a dialog over the editor (both loaded as it is first opened).
    return () =>
      void Promise.all([
        import('@angular/material/dialog'),
        import('@myrddraall/heroes-replay-stats-settings/feature'),
      ]).then(([{ MatDialog }, { SettingsDialog }]) =>
        injector.get(MatDialog).open(SettingsDialog, {
          ariaLabel: 'Settings',
          autoFocus: 'dialog',
          width: '760px',
          maxWidth: '95vw',
          maxHeight: '90vh',
        }),
      );
  },
};
