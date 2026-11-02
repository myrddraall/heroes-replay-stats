import type { Provider } from '@angular/core';
import { DesktopPlatform } from './desktop-platform';
import { PLATFORM } from './platform';
import { WebPlatform } from './web-platform';

/** Desktop when the Electron preload bridge is present, the browser otherwise. */
export function providePlatform(): Provider {
  return {
    provide: PLATFORM,
    useFactory: () =>
      window.heroesDesktop ? new DesktopPlatform(window.heroesDesktop) : new WebPlatform(),
  };
}
