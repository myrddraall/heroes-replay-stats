import { inject, type Provider } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideSettingsSection } from '@myrddraall/heroes-replay-stats-settings/ui';
import { provideShellLook } from '@myrddraall/heroes-replay-stats-shell/ui';
import { ThemeStore } from '../data';

/**
 * The theme in an app: the shell's look follows it, the settings have a Theme section, and every
 * form field (a select, a text field) is outlined, the one appearance the theme styles (its
 * TextField and Select).
 */
export function provideThemeFeature(): Provider[] {
  return [
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    provideShellLook(() => {
      const theme = inject(ThemeStore);
      return { theme: theme.theme, opacity: theme.opacity, blur: theme.blur };
    }),
    provideSettingsSection({
      id: 'theme',
      order: 20,
      load: () => import('../feature').then((m) => m.ThemeSection),
    }),
  ];
}
