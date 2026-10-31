import type { TintsSet } from '@myrddraall/heroes-replay-stats-aether/tints';
import { adjustmentAt } from '../materials/material-views';
import type { TreeMove } from '../tree/scene-tree';
import { editedTints, type TintEdit, type TintRow } from './tint-rows';

/**
 * What has colour adjustments (a body, a material, the sky), as an editor finds it by its row's
 * key: them as listed, the level edited's own (and switches), and how that level's are set.
 */
export interface AdjustmentsOwner {
  /** Whether they are a scene's colour grading (its kinds; none before lighting or masked). */
  readonly grading?: boolean;
  readonly rows: readonly TintRow[];
  readonly set: TintsSet | undefined;
  write(set: TintsSet | undefined): void;
}

/** A row's colour adjustments, as its panel shows them: their owner's row, them as listed and as set there, and the one the row is, if it is one. */
export interface AdjustmentsView {
  readonly owner: string;
  readonly grading?: boolean;
  readonly rows: readonly TintRow[];
  readonly set: TintsSet | undefined;
  readonly row?: TintRow;
}

/** Settings with their tints as set (none: none set there), the rest as they are. */
export function withTints<T extends TintsSet>(settings: T, set: TintsSet | undefined): T {
  const out = { ...settings } as Record<string, unknown>;
  delete out['tints'];
  delete out['tintsEnabled'];
  return { ...out, ...set } as T;
}

/**
 * The colour adjustments' part of an editor, from how it finds what has them (`of`, by its row's
 * key): a row's (their category's, or one of them's), and edits of them at the level edited; a
 * switch of one from the tree, and one moved among the level's own (each saying whether the key
 * was one of them, so the tree's handlers can try them first).
 */
export function adjustmentMethods(of: (owner: string) => AdjustmentsOwner | null) {
  const ownerAt = (key: string) => {
    const at = adjustmentAt(key);
    const owner = at && of(at.owner);
    return at && owner ? { ...at, owner: at.owner, found: owner } : null;
  };
  const edit = (key: string, change: TintEdit): void => {
    const at = ownerAt(key);
    if (at) at.found.write(editedTints(at.found.set, at.found.rows, change));
  };
  return {
    adjustmentsAt(key: string): AdjustmentsView | null {
      const at = ownerAt(key);
      if (!at) return null;
      const row = at.id ? at.found.rows.find((r) => r.tint.id === at.id) : undefined;
      return {
        owner: at.owner,
        ...(at.found.grading ? { grading: true } : {}),
        rows: at.found.rows,
        set: at.found.set,
        ...(row ? { row } : {}),
      };
    },
    editAdjustments: edit,
    /** One switched on or off from the tree; whether the key was one. */
    switchAdjustment(key: string, on: boolean): boolean {
      const at = adjustmentAt(key);
      if (!at?.id) return false;
      edit(key, { kind: 'switch', id: at.id, on });
      return true;
    },
    /** One of the level's own moved before or after another of them in the tree; whether the move was of one. */
    moveAdjustment(move: TreeMove): boolean {
      const from = adjustmentAt(move.key);
      const to = adjustmentAt(move.target);
      if (!from?.id) return false;
      if (!to?.id || to.owner !== from.owner) return true;
      const own = (of(from.owner)?.rows ?? [])
        .filter((r) => r.from === undefined && r.tint.id !== from.id)
        .map((r) => r.tint.id);
      const at = own.indexOf(to.id);
      if (at >= 0) edit(move.key, { kind: 'move', id: from.id, to: at + (move.after ? 1 : 0) });
      return true;
    },
  };
}
