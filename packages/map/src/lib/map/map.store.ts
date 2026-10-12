import { signalMethod, signalStore, withMethods } from '@ngrx/signals';
import { withElementStates } from './with-element-states';
import { withMapPack } from './with-map-pack';

/**
 * {@link HeroesMap}'s component store: one map, read from the global map store
 * ({@link withMapPack}), and what is shown of it ({@link withElementStates}).
 */
export const MapStore = signalStore(
  withMapPack(),
  withElementStates(),
  withMethods((store) => ({
    /** Shows a map, by id; follows the signal it is given. */
    load: signalMethod<string>((mapId) => {
      store.resetElements();
      store.showMap(mapId);
    }),
  })),
);
