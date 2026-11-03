import { inject, type Provider } from '@angular/core';
import { provideSettingsSection } from '@myrddraall/heroes-replay-stats-settings/ui';
import { provideShellLook } from '@myrddraall/heroes-replay-stats-shell/ui';
import { ThemeStore } from '../data';

/** The theme in an app: the shell's look follows it, and the settings have a Theme section. */
export function provideThemeFeature(): Provider[] {
  return [
    provideShellLook(() => {
      const theme = inject(ThemeStore);
      return {
        theme: theme.theme,
        glassAlpha: theme.glassAlpha,
        frameAlpha: theme.frameAlpha,
        blur: theme.blur,
      };
    }),
    provideSettingsSection({
      id: 'theme',
      order: 20,
      load: () => import('../feature').then((m) => m.ThemeSection),
    }),
  ];
}
