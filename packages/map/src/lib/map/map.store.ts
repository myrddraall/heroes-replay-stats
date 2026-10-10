import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { ElementShown } from '../layers/elements/element-pieces';
import { MapPacksService } from '../pack/map-packs.service';
import { clickedState, elementStatesOf, type KindStates } from './element-states';

interface MapState {
  readonly mapId: string | null;
  /** The pack's layers left out, by id. */
  readonly hiddenLayers: readonly string[];
  readonly arena: number;
  readonly kinds: KindStates;
  /** The structures and camps set on their own (clicked), by key. */
  readonly overrides: Readonly<Record<string, ElementShown>>;
}

const INITIAL: MapState = {
  mapId: null,
  hiddenLayers: [],
  arena: 0,
  kinds: { structure: 'standing', camp: 'spawned' },
  overrides: {},
};

/**
 * {@link HeroesMap}'s component store: which map, the map as it loads (`MapPacksService`), and
 * what is shown of it.
 */
export const MapStore = signalStore(
  withState<MapState>(INITIAL),
  withProps(({ mapId }, packs = inject(MapPacksService)) => ({
    _map: resource({
      params: () => mapId() ?? undefined,
      loader: ({ params, abortSignal }) => packs.open(params, abortSignal),
    }),
  })),
  withComputed(({ _map, kinds, overrides }) => {
    const map = computed(() => (_map.hasValue() ? _map.value() : null));
    return {
      map,
      loading: computed(() => _map.isLoading()),
      error: computed(() => _map.error()?.message ?? null),
      elementStates: computed(() => {
        const m = map();
        return m ? elementStatesOf(m.pack, kinds(), overrides()) : {};
      }),
    };
  }),
  withMethods((store) => ({
    /** Shows a map, by id; follows the signal it is given. */
    load: signalMethod<string>((mapId) => patchState(store, { ...INITIAL, mapId })),
    /** An element was clicked: it steps to its next state. */
    cycleElement(key: string): void {
      const current = store.elementStates()[key];
      const next = current && clickedState(key, current);
      if (next) patchState(store, { overrides: { ...store.overrides(), [key]: next } });
    },
    /** The minimap's loading screen faded away: it is off from then on. */
    minimapFaded(): void {
      if (!store.hiddenLayers().includes('minimap')) {
        patchState(store, { hiddenLayers: [...store.hiddenLayers(), 'minimap'] });
      }
    },
  })),
);
