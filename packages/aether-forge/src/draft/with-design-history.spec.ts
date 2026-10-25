import { TestBed } from '@angular/core/testing';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Design, EMPTY_LIBRARY, EMPTY_SCENES } from "@myrddraall/heroes-replay-stats-aether/design";
import { HISTORY_COALESCE, withDesignHistory } from './with-design-history';

let clock = 0;
const Store = signalStore(
  withState<Design>({ library: EMPTY_LIBRARY, scenes: EMPTY_SCENES }),
  withMethods((store) => ({
    name(scene: string, name: string): void {
      const scenes = store.scenes();
      patchState(store, {
        scenes: { ...scenes, planets: { ...scenes.planets, [scene]: { name } } },
      });
    },
  })),
  withDesignHistory(() => clock),
);

describe('a design’s history', () => {
  beforeEach(() => {
    clock = 0;
    TestBed.configureTestingModule({ providers: [Store] });
  });

  /** A change made at a time, taken in as it lands. */
  const change = (store: InstanceType<typeof Store>, at: number, name: string) => {
    clock = at;
    store.name('s', name);
    TestBed.tick();
  };
  const named = (store: InstanceType<typeof Store>) => store.scenes().planets['s']?.name;

  it('undoes and redoes changes, step by step', () => {
    const store = TestBed.inject(Store);
    TestBed.tick();
    expect(store.canUndo()).toBe(false);
    change(store, 1000, 'one');
    change(store, 5000, 'two');
    expect(store.canUndo()).toBe(true);
    store.undo();
    TestBed.tick();
    expect(named(store)).toBe('one');
    store.undo();
    TestBed.tick();
    expect(named(store)).toBeUndefined();
    expect(store.canUndo()).toBe(false);
    store.redo();
    TestBed.tick();
    store.redo();
    TestBed.tick();
    expect(named(store)).toBe('two');
    expect(store.canRedo()).toBe(false);
  });

  it('takes changes coming close together as one (a drag), and drops what was undone on an edit', () => {
    const store = TestBed.inject(Store);
    TestBed.tick();
    change(store, 1000, 'a');
    change(store, 1000 + HISTORY_COALESCE / 2, 'ab');
    change(store, 1000 + HISTORY_COALESCE, 'abc');
    store.undo();
    TestBed.tick();
    expect(named(store)).toBeUndefined();
    expect(store.canRedo()).toBe(true);
    change(store, 9000, 'other');
    expect(store.canRedo()).toBe(false);
  });

  it('takes the changes made while held as one step, however far apart (a drag)', () => {
    const store = TestBed.inject(Store);
    TestBed.tick();
    change(store, 1000, 'before');
    store.holdHistory();
    change(store, 5000, 'd');
    change(store, 9000, 'dr');
    change(store, 20000, 'drag');
    store.releaseHistory();
    store.undo();
    TestBed.tick();
    expect(named(store)).toBe('before');
  });
});
