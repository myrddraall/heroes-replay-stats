/** The contract between preload and renderer; mirrors `HeroesDesktopBridge` in the app. */
export interface PickedReplayFile {
  readonly name: string;
  readonly path: string;
  readonly bytes: Uint8Array;
}

export const CHANNELS = {
  pickReplays: 'hrs:pick-replays',
  defaultReplayDirectory: 'hrs:default-replay-directory',
} as const;
