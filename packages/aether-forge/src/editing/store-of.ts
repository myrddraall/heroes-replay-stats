import type {
  SignalStoreFeature,
  SignalStoreFeatureResult,
  StateSignals,
  WritableStateSource,
} from '@ngrx/signals';

/** What a store feature makes: its state, props and methods. */
type MadeBy<F extends () => SignalStoreFeature> =
  ReturnType<F> extends SignalStoreFeature<never, infer O extends SignalStoreFeatureResult>
    ? O
    : never;

/**
 * A store as a feature makes it, as what is computed over it sees it: its state as signals, its
 * props and its methods. A store is composed of layers, each a function of the store under it
 * (`withComputed(viewsOf)`), each in a file of its own.
 */
export type StoreOf<F extends () => SignalStoreFeature> = StateSignals<MadeBy<F>['state']> &
  MadeBy<F>['props'] &
  MadeBy<F>['methods'];

/** A store as a feature makes it, as its methods see it: its state writable too (`patchState`). */
export type WritableStoreOf<F extends () => SignalStoreFeature> = StoreOf<F> &
  WritableStateSource<MadeBy<F>['state']>;
