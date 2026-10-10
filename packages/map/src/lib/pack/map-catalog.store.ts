import { computed, inject, resource } from '@angular/core';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { readableMaps, type MapCatalogEntry } from './map-catalog';
import { MapPacksService } from './map-packs.service';

/** A map of the catalog, with its thumbnail's URL. */
export interface MapCatalogItem extends MapCatalogEntry {
  readonly thumbnailUrl: string | null;
}

/** heroes-maps' catalog, shared by the whole app: loaded the first time it is needed, the maps this viewer can read. */
export const MapCatalogStore = signalStore(
  { providedIn: 'root' },
  withProps((_, packs = inject(MapPacksService)) => ({
    _packs: packs,
    _catalog: resource({ loader: ({ abortSignal }) => packs.catalog(abortSignal) }),
  })),
  withComputed(({ _catalog, _packs }) => ({
    maps: computed((): readonly MapCatalogItem[] =>
      _catalog.hasValue()
        ? readableMaps(_catalog.value()).map((m) => ({
            ...m,
            thumbnailUrl: m.thumbnail ? _packs.fileUrl(m.thumbnail.file) : null,
          }))
        : [],
    ),
    loading: computed(() => _catalog.isLoading()),
    error: computed(() => _catalog.error()?.message ?? null),
  })),
);
