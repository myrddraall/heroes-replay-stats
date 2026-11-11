import { computed, effect, signal, untracked } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  type,
  withComputed,
  withHooks,
  withMethods,
  withProps,
} from '@ngrx/signals';
import type { Design } from '@myrddraall/heroes-replay-stats-aether/design';
/** How long after a change the next is taken as part of it (a drag, a scrub), in milliseconds. */
export const HISTORY_COALESCE = 600;
/** How many steps back are kept. */
export const HISTORY_SIZE = 200;

/** A design's history as it is undone and redone: what it was, what was undone, what it is. */
interface History {
  past: Design[];
  future: Design[];
  current: Design | null;
  /** When it last changed (by an edit). */
  last: number;
  /**
   * Whether changes are held as one step (a drag, from press to release): none; held, its step
   * not taken yet; or taken (what comes in the same hold goes into it).
   */
  held: 'open' | 'taken' | null;
}

/**
 * Undo and redo for a store holding a design (its library and scenes): each change is a step,
 * those coming within `HISTORY_COALESCE` of the one before taken as one (a scrub), and those made
 * while it is held (`holdHistory`: a drag, from press to release) as one whatever their pace; an
 * undo puts the design back as it was before the last step, a redo as it was after; an edit after
 * an undo drops what was undone. Kept while the page is open, not saved.
 */
export function withDesignHistory(now: () => number = () => Date.now()) {
  return signalStoreFeature(
    { state: type<Design>() },
    withProps(() => ({
      _history: { past: [], future: [], current: null, last: 0, held: null } as History,
      /** Bumped whenever the history changes (for what may be undone and redone). */
      _historyRevision: signal(0),
    })),
    withComputed(({ _history, _historyRevision }) => ({
      canUndo: computed(() => (_historyRevision(), _history.past.length > 0)),
      canRedo: computed(() => (_historyRevision(), _history.future.length > 0)),
    })),
    withMethods((store) => {
      const h = store._history;
      const bump = () => store._historyRevision.update((n) => n + 1);
      const replay = (to: Design | undefined, from: Design[]) => {
        if (!to || !h.current) return;
        from.push(h.current);
        // What it is now (so its landing isn't taken as an edit), the next edit a step of its own.
        h.last = 0;
        h.current = to;
        patchState(store, { library: to.library, scenes: to.scenes });
        bump();
      };
      return {
        /** The design back as it was before the last step. */
        undo(): void {
          replay(h.past.pop(), h.future);
        },
        /** The step undone last made again. */
        redo(): void {
          replay(h.future.pop(), h.past);
        },
        /** What changes from now on taken as one step (a drag begun), till `releaseHistory`. */
        holdHistory(): void {
          h.held = 'open';
        },
        /** Changes taken as steps of their own again (a drag ended). */
        releaseHistory(): void {
          h.held = null;
          h.last = 0;
        },
        /** A change of the design taken into the history (an undo's or a redo's is already). */
        _record(design: Design): void {
          const current = h.current;
          if (current && current.library === design.library && current.scenes === design.scenes)
            return;
          if (!current) {
            h.current = design;
            return;
          }
          const at = now();
          const step =
            h.held === 'open' ||
            (h.held === null && (at - h.last > HISTORY_COALESCE || !h.past.length));
          if (h.held === 'open') h.held = 'taken';
          if (step) {
            h.past.push(current);
            if (h.past.length > HISTORY_SIZE) h.past.shift();
          }
          h.last = at;
          h.future = [];
          h.current = design;
          bump();
        },
      };
    }),
    withHooks({
      onInit(store) {
        // Each change of the design (together, as it lands), taken in.
        effect(() => {
          const design: Design = { library: store.library(), scenes: store.scenes() };
          untracked(() => store._record(design));
        });
      },
    }),
  );
}
