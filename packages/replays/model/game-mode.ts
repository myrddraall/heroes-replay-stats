import type { GameMode } from '@myrddraall/heroprotocol-db';

/** The modes whose games pick heroes in a draft (bans and picks in turn). */
const DRAFT_MODES: ReadonlySet<GameMode> = new Set([
  'unranked-draft',
  'hero-league',
  'team-league',
  'storm-league',
  'custom-draft',
]);

/** Whether a game of this mode has a draft. */
export function hasDraft(mode: GameMode): boolean {
  return DRAFT_MODES.has(mode);
}
