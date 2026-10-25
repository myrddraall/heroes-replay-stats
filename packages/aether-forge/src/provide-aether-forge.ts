import { type EnvironmentProviders, makeEnvironmentProviders, type Signal, signal } from '@angular/core';
import { ROUTES } from '@angular/router';
import { FORGE_OPTIONS, type ForgeOptions } from './forge-options';
import { forgeMatcher } from './page/forge-matcher';

/** How an app brings in the editor. */
export interface AetherForgeOptions {
  /** The editor's URL under the app's root, without slashes (`edit-background`). */
  readonly path: string;
  /** Where leaving the editor goes when it was opened on its own (default: the app's root). */
  readonly exit?: string;
  /** The page's title. */
  readonly title?: string;
  /** The class the app's theme styles glass panels with, read where the editor is injected. */
  readonly panelClass?: () => Signal<string>;
  /** Makes what opens the app's settings, where the editor is injected (none: no Settings item). */
  readonly openSettings?: () => () => void;
}

/**
 * The editor in an app: its route (a page of its own at `path`, filling the window, loaded when
 * first opened) and what it needs from the app. List it before `provideRouter`, so its route comes
 * before the app's own (and their catch-all).
 */
export function provideAetherForge(options: AetherForgeOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ROUTES,
      multi: true,
      useValue: [
        {
          matcher: forgeMatcher(options.path),
          title: options.title,
          loadComponent: () => import('./page/forge-page').then((m) => m.ForgePage),
        },
      ],
    },
    {
      provide: FORGE_OPTIONS,
      useFactory: (): ForgeOptions => ({
        path: options.path,
        exit: options.exit ?? '/',
        panelClass: options.panelClass?.() ?? signal(''),
        openSettings: options.openSettings?.() ?? null,
      }),
    },
  ]);
}
