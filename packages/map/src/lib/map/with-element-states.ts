import { computed, type Signal } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  type,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { KIND_STATES, type ElementShown } from '../layers/elements/element-pieces';
import type { MapPack } from '../pack/map-pack';
import { clickedState, elementStatesOf, kindOfKey, type KindStates } from './element-states';

export interface ElementStatesState {
  /** What every structure and every camp shows, unless one was set on its own. */
  readonly kinds: KindStates;
  /** The structures and camps set on their own, by key. */
  readonly overrides: Readonly<Record<string, ElementShown>>;
}

const INITIAL: ElementStatesState = {
  kinds: { structure: 'standing', camp: 'spawned' },
  overrides: {},
};

/**
 * What a map's structures and camps show, for a component store that has the `pack`
 * ({@link withMapPack}): each kind's default, the ones set on their own, and `elementStates`
 * for the viewer.
 */
export function withElementStates() {
  return signalStoreFeature(
    type<{ props: { pack: Signal<MapPack | null> } }>(),
    withState<ElementStatesState>(INITIAL),
    withComputed(({ pack, kinds, overrides }) => ({
      elementStates: computed((): Record<string, ElementShown> => {
        const p = pack();
        return p ? elementStatesOf(p, kinds(), overrides()) : {};
      }),
    })),
    withMethods((store) => ({
      /** One element set to a state of its kind; anything else is ignored. */
      setElementState(key: string, state: ElementShown): void {
        const kind = kindOfKey(key);
        if (!kind || !(KIND_STATES[kind] as readonly string[]).includes(state)) return;
        patchState(store, { overrides: { ...store.overrides(), [key]: state } });
      },
      /** An element was clicked: it steps to its next state. */
      cycleElement(key: string): void {
        const current = store.elementStates()[key];
        const next = current && clickedState(key, current);
        if (next) patchState(store, { overrides: { ...store.overrides(), [key]: next } });
      },
      /** Every element back to its kind's default. */
      resetElements(): void {
        patchState(store, INITIAL);
      },
    })),
  );
}
