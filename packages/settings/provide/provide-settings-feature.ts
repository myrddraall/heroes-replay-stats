import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellMenuItem } from '@myrddraall/heroes-replay-stats-shell/ui';
import { SETTINGS_ROUTES } from './routes';

/**
 * The settings in an app: the Settings page, in the settings menu with its About part. List it
 * before `provideRouter`.
 */
export function provideSettingsFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: SETTINGS_ROUTES },
    provideShellMenuItem({ label: 'Settings', link: '/settings', order: 10 }),
    provideShellMenuItem({ label: 'About', link: '/settings', fragment: 'about', order: 20 }),
  ];
}
