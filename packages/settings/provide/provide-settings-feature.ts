import type { Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideShellNavItem } from '@myrddraall/heroes-replay-stats-shell/ui';
import { SETTINGS_ROUTES } from './routes';

/** The settings in an app: the Settings page and its nav item. List it before `provideRouter`. */
export function provideSettingsFeature(): Provider[] {
  return [
    { provide: ROUTES, multi: true, useValue: SETTINGS_ROUTES },
    provideShellNavItem({ path: '/settings', label: 'Settings', icon: 'settings', order: 70 }),
  ];
}
