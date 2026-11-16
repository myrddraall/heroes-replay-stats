/**
 * Whether you have looked at a match: `new` until you open it, `viewed` after, and `updated`
 * once its file is imported again after you last opened it.
 */
export type ReplayViewed = 'new' | 'viewed' | 'updated';

/**
 * A match's {@link ReplayViewed}, from when it was imported and the import you last saw
 * (`undefined` when you never opened it).
 */
export function replayViewed(importedAt: string, seenImport: string | undefined): ReplayViewed {
  return seenImport === undefined ? 'new' : seenImport === importedAt ? 'viewed' : 'updated';
}
