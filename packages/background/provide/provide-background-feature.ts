import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideAether } from '@myrddraall/heroes-replay-stats-aether';
import { provideAetherForge } from '@myrddraall/heroes-replay-stats-aether-forge';
import { provideSettingsSection } from '@myrddraall/heroes-replay-stats-settings/ui';
import { provideShellBackdrop, provideShellNavItem } from '@myrddraall/heroes-replay-stats-shell/ui';
import { PRESETS } from '../model';
import { BACKGROUND_EDITOR, BACKGROUND_EDITOR_PATH } from './background-editor';
import { provideGraphicsCarryOver } from './carry-over-graphics';
import { provideSiteBackground } from './provide-site-background';
import { BACKGROUND_ROUTES } from './routes';

/**
 * The site's background in an app: Aether drawing the Play screen's, behind every page; its
 * editor (the Background page) and the theme preview, with their nav items; its Graphics settings;
 * its colour, which can change with each page. List it before `provideRouter`.
 */
export function provideBackgroundFeature(): EnvironmentProviders {
  return makeEnvironmentProviders([
    // Before provideAether: the graphics settings saved earlier, where it reads them.
    provideGraphicsCarryOver(),
    provideAether({
      dataUrl: 'backgrounds/play/',
      storage: { keyPrefix: 'hrs.background-', databasePrefix: 'hrs-background-' },
      tintPresets: PRESETS,
    }),
    provideAetherForge(BACKGROUND_EDITOR),
    { provide: ROUTES, multi: true, useValue: BACKGROUND_ROUTES },
    provideShellNavItem({ path: '/theme-preview', label: 'Theme preview', icon: 'palette', order: 50 }),
    provideShellNavItem({
      path: `/${BACKGROUND_EDITOR_PATH}`,
      label: 'Background',
      icon: 'wallpaper',
      order: 60,
    }),
    provideShellBackdrop(() => import('../feature/site-backdrop').then((m) => m.SiteBackdrop)),
    provideSettingsSection({
      id: 'graphics',
      order: 10,
      load: () => import('../feature/graphics-section').then((m) => m.GraphicsSection),
    }),
    provideSiteBackground(),
  ]);
}
