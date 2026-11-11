import type { Provider } from '@angular/core';
import { DesktopPlatform, PLATFORM, WebPlatform } from '../data';

export interface PlatformFeatureOptions {
  /** The app's version, which the browser platform reports (the desktop's comes from its shell). */
  readonly version: string;
}

/** The platform the app runs on: desktop when the Electron preload bridge is present, the browser otherwise. */
export function providePlatformFeature({ version }: PlatformFeatureOptions): Provider {
  return {
    provide: PLATFORM,
    useFactory: () =>
      window.heroesDesktop ? new DesktopPlatform(window.heroesDesktop) : new WebPlatform(version),
  };
}
