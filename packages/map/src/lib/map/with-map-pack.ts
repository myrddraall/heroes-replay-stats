import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { swappedTeamColours, type TeamColours } from '../layers/team-colour';
import { MapsStore } from '../pack/maps.store';
import { arenasOf, type Arena } from '../view/arenas';

export interface MapPackState {
  readonly mapId: string | null;
  /** The pack's layers left out, by id. */
  readonly hiddenLayers: readonly string[];
  readonly arena: number;
  /** The teams shown in each other's colours (PACK.md, Team colour). */
  readonly teamColoursSwapped: boolean;
}

const INITIAL: MapPackState = {
  mapId: null,
  hiddenLayers: [],
  arena: 0,
  teamColoursSwapped: false,
};

/**
 * A component store's hook-up to the global {@link MapsStore} for one map: which map (`showMap`),
 * and the map as the global store has it (`map`, `pack`, `loading`, `error`), plus what the
 * container shows of it (the arena, the layers left out, the team colours swapped). The loading
 * itself is the global store's.
 */
export function withMapPack() {
  return signalStoreFeature(
    withState<MapPackState>(INITIAL),
    withProps(() => ({ _maps: inject(MapsStore) })),
    withComputed(({ mapId, teamColoursSwapped, _maps }) => {
      const _packEntry = computed(() => {
        const id = mapId();
        return id ? _maps.packs()[id] : undefined;
      });
      const map = computed(() => {
        const entry = _packEntry();
        return entry?.status === 'ready' ? entry.map : null;
      });
      const pack = computed(() => map()?.pack ?? null);
      return {
        _packEntry,
        map,
        pack,
        /** The pack's arenas (one, the whole map, unless it has several); the chosen one is `arena`. */
        arenas: computed((): readonly Arena[] => {
          const p = pack();
          return p ? arenasOf(p) : [];
        }),
        /** Whether the map has team colour to show in other colours: a layer's or a structure's. */
        hasTeamColour: computed(() => {
          const p = pack();
          return (
            !!p &&
            (p.layers.some((l) => l.kind !== 'fixed' && l.teamMask) ||
              !!p.data.elements?.atlases.team)
          );
        }),
        /** The colours the viewer shows the teams in; null: as the pack has them. */
        teamColours: computed((): TeamColours | null => {
          const p = pack();
          return p && teamColoursSwapped() ? swappedTeamColours(p.teamColours) : null;
        }),
        loading: computed(() => _packEntry()?.status === 'loading'),
        error: computed(() => {
          const entry = _packEntry();
          return entry?.status === 'error' ? entry.error : null;
        }),
      };
    }),
    withMethods((store) => ({
      /** Shows a map, by id: the pack is asked of the global store, and the view starts afresh. */
      showMap(mapId: string): void {
        patchState(store, { ...INITIAL, mapId });
        void store._maps.loadPack(mapId);
      },
      /** Shows one of the pack's arenas, by index (a map of several). */
      showArena(index: number): void {
        if (index !== store.arena()) patchState(store, { arena: index });
      },
      /** The teams shown in each other's colours, or back in their own. */
      toggleTeamColours(): void {
        patchState(store, { teamColoursSwapped: !store.teamColoursSwapped() });
      },
      /** The minimap's loading screen faded away: it is off from then on. */
      minimapFaded(): void {
        if (!store.hiddenLayers().includes('minimap')) {
          patchState(store, { hiddenLayers: [...store.hiddenLayers(), 'minimap'] });
        }
      },
    })),
  );
}
