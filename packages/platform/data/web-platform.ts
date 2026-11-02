import type { PickedReplay, Platform } from '../model';

/** The browser: a hidden file input; no filesystem knowledge. */
export class WebPlatform implements Platform {
  readonly kind = 'web' as const;

  /** `version`: the app's, as its build knows it. */
  constructor(readonly version: string) {}

  pickReplays(): Promise<readonly PickedReplay[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.StormReplay,.StormR';
      input.multiple = true;
      input.addEventListener('change', async () => {
        const files = [...(input.files ?? [])];
        resolve(
          await Promise.all(
            files.map(async (f) => ({
              name: f.name,
              bytes: new Uint8Array(await f.arrayBuffer()),
            })),
          ),
        );
      });
      input.addEventListener('cancel', () => resolve([]));
      input.click();
    });
  }

  async defaultReplayDirectory(): Promise<string | undefined> {
    return undefined;
  }
}
