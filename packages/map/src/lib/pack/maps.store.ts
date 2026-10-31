import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { readableMaps, type MapCatalogEntry } from './map-catalog';
import { MapPacksService } from './map-packs.service';
import { failed, loaded, startLoading, type PackEntries } from './pack-entries';

/** A map of the catalog, with its thumbnail's URL. */
export interface MapCatalogItem extends MapCatalogEntry {
  readonly thumbnailUrl: string | null;
}

interface MapsState {
  /** The packs asked for so far, by map id: loading, loaded, or failed. */
  readonly packs: PackEntries;
}

/**
 * The map data, shared by the whole app (the global store; all loading of map data happens here):
 * heroes-maps' catalog, loaded the first time it is needed, and each map's pack, loaded when a
 * map is first shown and kept for the session. Component stores read it; `withMapPack` is how a
 * component store follows one map.
 */
export const MapsStore = signalStore(
  { providedIn: 'root' },
  withState<MapsState>({ packs: {} }),
  withProps((_, packs = inject(MapPacksService)) => ({
    _service: packs,
    _catalog: resource({ loader: ({ abortSignal }) => packs.catalog(abortSignal) }),
  })),
  withComputed(({ _catalog, _service }) => ({
    /** The catalog's maps this viewer can read. */
    maps: computed((): readonly MapCatalogItem[] =>
      _catalog.hasValue()
        ? readableMaps(_catalog.value()).map((m) => ({
            ...m,
            thumbnailUrl: m.thumbnail ? _service.fileUrl(m.thumbnail.file) : null,
          }))
        : [],
    ),
    loading: computed(() => _catalog.isLoading()),
    error: computed(() => _catalog.error()?.message ?? null),
  })),
  withMethods((store) => ({
    /** Loads a map's pack, once: a pack already loading or loaded is left as it is. */
    async loadPack(mapId: string): Promise<void> {
      if (store.packs()[mapId]) return;
      patchState(store, { packs: startLoading(store.packs(), mapId) });
      try {
        const map = await store._service.open(mapId);
        patchState(store, { packs: loaded(store.packs(), mapId, map) });
      } catch (e) {
        patchState(store, {
          packs: failed(store.packs(), mapId, e instanceof Error ? e.message : String(e)),
        });
      }
    },
  })),
);
