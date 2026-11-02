import type { HeroesDesktopBridge, PickedReplay, Platform } from './platform';

/** The Electron shell, through the preload bridge. */
export class DesktopPlatform implements Platform {
  readonly kind = 'desktop' as const;
  readonly version: string;

  constructor(private readonly bridge: HeroesDesktopBridge) {
    this.version = bridge.version;
  }

  async pickReplays(): Promise<readonly PickedReplay[]> {
    return (await this.bridge.pickReplays()).map((f) => ({
      name: f.name,
      path: f.path,
      bytes: f.bytes,
    }));
  }

  defaultReplayDirectory(): Promise<string | undefined> {
    return this.bridge.defaultReplayDirectory();
  }
}
