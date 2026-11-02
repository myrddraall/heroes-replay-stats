import { InjectionToken, inject } from '@angular/core';

/** A replay file picked by the user, wherever it came from. */
export interface PickedReplay {
  readonly name: string;
  readonly bytes: Uint8Array;
  /** Absolute path when the platform knows it (desktop); undefined in the browser. */
  readonly path?: string;
}

/**
 * The one seam between the Angular app and the shell it runs in. The browser build
 * uses `WebPlatform`; the Electron shell exposes `window.heroesDesktop` and the app
 * picks `DesktopPlatform` when it is present. Nothing else in the app knows which.
 */
export interface Platform {
  readonly kind: 'web' | 'desktop';
  /** Product version as the shell knows it. */
  readonly version: string;
  /** Let the user pick one or more `.StormReplay` files. */
  pickReplays(): Promise<readonly PickedReplay[]>;
  /** Directory the game writes replays to, when the platform can know it. */
  defaultReplayDirectory(): Promise<string | undefined>;
}

export const PLATFORM = new InjectionToken<Platform>('hrs.platform');

export function injectPlatform(): Platform {
  return inject(PLATFORM);
}

/** What the desktop preload script puts on `window`. */
export interface HeroesDesktopBridge {
  readonly version: string;
  pickReplays(): Promise<readonly { name: string; path: string; bytes: Uint8Array }[]>;
  defaultReplayDirectory(): Promise<string | undefined>;
}

declare global {
  interface Window {
    heroesDesktop?: HeroesDesktopBridge;
  }
}
