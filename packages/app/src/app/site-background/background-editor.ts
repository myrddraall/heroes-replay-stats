import { computed, inject, Injector } from '@angular/core';
import { type AetherForgeOptions } from '@myrddraall/heroes-replay-stats-aether-forge';
import { GraphicsStore } from '../data/settings/graphics.store';

/** The background editor's URL under the app's root. */
export const BACKGROUND_EDITOR_PATH = 'edit-background';

/** The background editor in the app: its page, styled as the Graphics settings' theme. */
export const BACKGROUND_EDITOR: AetherForgeOptions = {
  path: BACKGROUND_EDITOR_PATH,
  title: 'Play screen background · Heroes Replay Stats',
  panelClass: () => {
    const graphics = inject(GraphicsStore);
    return computed(() => `hrs-glass-${graphics.theme()}`);
  },
  openSettings: () => {
    const injector = inject(Injector);
    // The settings, in a dialog over the editor (both loaded as it is first opened).
    return () =>
      void Promise.all([
        import('@angular/material/dialog'),
        import('../pages/settings/settings-dialog'),
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
