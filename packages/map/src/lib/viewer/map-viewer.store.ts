import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { MapViewModel } from '../pack/map-assets';
import { arenasOf } from '../view/arenas';
import {
  clampCamera,
  fitZoom,
  MIN_ZOOM_OF_FIT,
  panBy,
  zoomAbout,
  type Camera,
  type ViewPoint,
  type Viewport,
} from '../view/camera';
import { packStack } from '../view/layer-stack';
import type { MapView } from './map-layer';

interface MapViewerState {
  readonly map: MapViewModel | null;
  readonly arenaIndex: number;
  readonly camera: Camera;
  readonly viewport: Viewport;
  /** The camera has been placed over the shown arena (it needs the viewer's size first). */
  readonly placed: boolean;
}

/**
 * The viewer's own UI state, one per viewer (provided by {@link MapViewer}; a presenter store):
 * the map it was given, the arena, the camera, the viewer's size, and the pack's layer stack.
 * The layers inside the viewer read it.
 */
export const MapViewerStore = signalStore(
  withState<MapViewerState>({
    map: null,
    arenaIndex: 0,
    camera: { cx: 0, cy: 0, zoom: 1 },
    viewport: { width: 0, height: 0, dpr: 1 },
    placed: false,
  }),
  withComputed(({ map, arenaIndex, camera, viewport, placed }) => {
    const arenas = computed(() => {
      const m = map();
      return m ? arenasOf(m.pack) : [];
    });
    const arena = computed(() => arenas()[arenaIndex()] ?? arenas()[0] ?? null);
    return {
      arenas,
      arena,
      /** The pack's own layers: their order and parallax rate, back to front. */
      stack: computed(() => {
        const m = map();
        return m ? packStack(m.pack) : [];
      }),
      /** The furthest out the camera may go. */
      minZoom: computed(() => {
        const a = arena();
        return a ? fitZoom(a, viewport()) * MIN_ZOOM_OF_FIT : 0;
      }),
      /** What there is to draw; `null` until there is a pack, a size and a camera. */
      view: computed((): MapView | null => {
        const m = map();
        const a = arena();
        return m && a && placed()
          ? { map: m, arena: a, camera: camera(), viewport: viewport() }
          : null;
      }),
    };
  }),
  withMethods((store) => {
    /** The camera over the middle of the arena, zoomed to fit it, once the viewer has a size. */
    function place(): void {
      const arena = store.arena();
      const viewport = store.viewport();
      if (!arena || viewport.width <= 0 || viewport.height <= 0) return;
      const [cx, cy] = arena.middle;
      patchState(store, { camera: { cx, cy, zoom: fitZoom(arena, viewport) }, placed: true });
    }
    function move(camera: Camera): void {
      const arena = store.arena();
      if (arena && store.placed()) patchState(store, { camera: clampCamera(camera, arena.bounds) });
    }
    return {
      setMap(map: MapViewModel | null): void {
        if (map === store.map()) return;
        patchState(store, { map, placed: false });
        place();
      },
      showArena(index: number): void {
        if (index === store.arenaIndex() && store.placed()) return;
        patchState(store, { arenaIndex: index, placed: false });
        place();
      },
      /** Back to the whole arena. */
      recentre(): void {
        patchState(store, { placed: false });
        place();
      },
      resize(viewport: Viewport): void {
        patchState(store, { viewport });
        if (!store.placed()) place();
      },
      /** A drag of (dx, dy) viewer pixels. */
      panBy(dx: number, dy: number): void {
        const arena = store.arena();
        if (arena) move(panBy(store.camera(), arena.layer.pxPerCell, dx, dy));
      },
      /** Zoom by a factor about a point of the viewer. */
      zoomAt(point: ViewPoint, factor: number): void {
        const arena = store.arena();
        if (!arena) return;
        const camera = store.camera();
        const viewport = store.viewport();
        const minZoom = store.minZoom();
        move(zoomAbout(camera, viewport, arena.layer.pxPerCell, point, factor, minZoom));
      },
    };
  }),
);
