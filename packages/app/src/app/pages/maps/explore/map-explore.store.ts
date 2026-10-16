import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  KIND_STATES,
  mapFactsOf,
  allPois,
  poisOf,
  withElementStates,
  withMapPack,
  type CentreRequest,
  type ElementShown,
  type Poi,
} from '@myrddraall/heroes-replay-stats-map';
import { map } from 'rxjs';
import { LatestHeroData } from '../../../data/heroes/hero-data';
import { mapArtOf, mapExtraInfoOf } from './map-info';

export type PanelPosition = 'start' | 'end';
export type PanelMode = 'side' | 'over' | 'push';

/** The two panels: the map's information on one side, the points of interest on the other. */
export type PanelName = 'info' | 'details';

/** How the panels are set up by the container's inputs. */
export interface PanelConfig {
  /** The details panel's side; the information panel takes the other. */
  readonly position: PanelPosition;
  readonly mode: PanelMode;
  /** Open or closed; left out, a panel is open except on a handset. */
  readonly detailsOpened?: boolean;
  readonly infoOpened?: boolean;
}

/** The point of interest picked, what it shows, and what it can show. */
export interface SelectedPoi {
  readonly poi: Poi;
  readonly state: ElementShown;
  readonly states: readonly ElementShown[];
}

/** The zoom a point of interest picked from the list is brought into view at, at least. */
const POI_ZOOM = 0.5;

interface ExploreState {
  /** The point of interest picked, by key. */
  readonly selected: string | null;
  /** The last place asked to be brought into view. */
  readonly centre: CentreRequest | null;
  readonly panels: {
    /** The details panel's side. */
    readonly position: PanelPosition;
    readonly mode: PanelMode;
    /** Each panel as set by the inputs or the user; null: open except on a handset. */
    readonly details: boolean | null;
    readonly info: boolean | null;
  };
}

/**
 * {@link MapExplore}'s component store: one map from the global map store ({@link withMapPack}),
 * what its structures and camps show ({@link withElementStates}), the point of interest picked,
 * the panel, and the map's facts and art (from the pack) with what hero-data adds (objectives,
 * their icons the pack's) — the two globals merged here, for this one consumer.
 */
export const MapExploreStore = signalStore(
  withMapPack(),
  withElementStates(),
  withState<ExploreState>({
    selected: null,
    centre: null,
    panels: { position: 'end', mode: 'side', details: null, info: null },
  }),
  withProps(() => ({
    _heroData: inject(LatestHeroData),
    _handset: toSignal(
      inject(BreakpointObserver)
        .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
        .pipe(map((r) => r.matches)),
      { initialValue: false },
    ),
  })),
  withComputed(({ map: loaded, pack, elementStates, selected, panels, _heroData, _handset }) => {
    const pois = computed(() => {
      const p = pack();
      return p ? poisOf(p) : [];
    });
    const art = computed(() => mapArtOf(loaded()));
    return {
      pois,
      facts: computed(() => {
        const p = pack();
        return p ? mapFactsOf(p) : null;
      }),
      art,
      extra: computed(() => {
        const p = pack();
        // Nothing until hero-data has loaded (or failed): the panel shows that it is loading.
        if (!p || (!_heroData.data.hasValue() && !_heroData.data.error())) return null;
        const data = _heroData.data.hasValue() ? _heroData.data.value() : undefined;
        return mapExtraInfoOf(p.map.name, data, art());
      }),
      extraLoading: computed(() => _heroData.data.isLoading()),
      selectedPoi: computed((): SelectedPoi | null => {
        const key = selected();
        if (!key) return null;
        const poi = allPois(pois()).find((p) => p.key === key);
        const state = elementStates()[key];
        return poi && state
          ? { poi, state, states: KIND_STATES[poi.kind] as readonly ElementShown[] }
          : null;
      }),
      panelMode: computed((): PanelMode => (_handset() ? 'over' : panels().mode)),
      detailsPosition: computed(() => panels().position),
      infoPosition: computed((): PanelPosition => (panels().position === 'end' ? 'start' : 'end')),
      detailsOpened: computed(() => panels().details ?? !_handset()),
      infoOpened: computed(() => panels().info ?? !_handset()),
    };
  }),
  withMethods((store) => ({
    /** Shows a map, by id; follows the signal it is given. The selection starts afresh. */
    load: signalMethod<string>((mapId) => {
      store.resetElements();
      patchState(store, { selected: null, centre: null });
      store.showMap(mapId);
    }),
    /** The panels as the inputs set them; follows the signal it is given. */
    configurePanels: signalMethod<PanelConfig>(({ position, mode, detailsOpened, infoOpened }) =>
      patchState(store, {
        panels: { position, mode, details: detailsOpened ?? null, info: infoOpened ?? null },
      }),
    ),
    /**
     * Picks a point of interest; with `centre`, brings it into view (from the list, where it may
     * be off screen). On a handset, picking one opens the details panel over the map.
     */
    select(key: string, centre = false): void {
      const poi = centre ? allPois(store.pois()).find((p) => p.key === key) : undefined;
      // On a map of several arenas, one from the list is on its own arena: shown first.
      const arena = poi ? store.arenas().findIndex((a) => a.layer.id === poi.layer) : -1;
      patchState(store, {
        selected: key,
        ...(arena >= 0 && arena !== store.arena() ? { arena } : {}),
        ...(poi ? { centre: { cell: poi.cell, minZoom: POI_ZOOM } } : {}),
        ...(store._handset() ? { panels: { ...store.panels(), details: true } } : {}),
      });
    },
    deselect(): void {
      patchState(store, { selected: null });
    },
    /** The picked point of interest set to show a state of its kind. */
    setSelectedState(state: ElementShown): void {
      const key = store.selected();
      if (key) store.setElementState(key, state);
    },
    togglePanel(panel: PanelName): void {
      const opened = panel === 'info' ? store.infoOpened() : store.detailsOpened();
      patchState(store, { panels: { ...store.panels(), [panel]: !opened } });
    },
    setPanelOpened(panel: PanelName, opened: boolean): void {
      const now = panel === 'info' ? store.infoOpened() : store.detailsOpened();
      if (opened !== now) patchState(store, { panels: { ...store.panels(), [panel]: opened } });
    },
  })),
);
