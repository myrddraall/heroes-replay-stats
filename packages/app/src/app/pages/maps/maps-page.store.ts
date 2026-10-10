import { inject } from '@angular/core';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { MapCatalogStore } from '@myrddraall/heroes-replay-stats-map';

/** {@link MapsPage}'s component store: heroes-maps' catalog. */
export const MapsPageStore = signalStore(
  withProps(() => ({ _catalog: inject(MapCatalogStore) })),
  withComputed(({ _catalog }) => ({
    maps: _catalog.maps,
    loading: _catalog.loading,
    error: _catalog.error,
  })),
);
