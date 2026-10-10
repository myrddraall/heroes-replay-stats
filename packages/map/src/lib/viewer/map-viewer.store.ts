import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { MapViewModel } from '../pack/map-assets';
import type { PackParallaxLayer } from '../pack/map-pack';
import { arenasOf } from '../view/arenas';
import {
  panBy,
  zoomAbout,
  type Camera,
  type ScreenBox,
  type ViewPoint,
  type Viewport,
} from '../view/camera';
import {
  fitCells,
  keptInArea,
  keptInSky,
  viewAtZoom,
  viewInside,
  type Framing,
  type FramingScene,
} from '../view/framing';
import { packStack } from '../view/layer-stack';
import type { MapView } from './map-layer';

/**
 * The bars where the viewer is too wide or too tall for the sky: `fixed`, as thick as the view
 * zoomed out all the way needs, at every zoom; `shrink`, receding as the camera zooms in, as far as
 * the sky fills the view at that zoom (the map stays put: only the view widens). Either way they
 * depend on the viewer's size and the zoom only, never on where the camera is.
 */
export type MapViewerBars = 'fixed' | 'shrink';

/** The view at a zoom: the one zoomed out all the way, or with `shrink` bars receded from it. */
function viewAt(
  zoom: number,
  framing: Framing,
  bars: MapViewerBars,
  host: Viewport,
  scene: FramingScene | null,
): ScreenBox {
  return scene && bars === 'shrink' ? viewAtZoom(zoom, framing, host, scene) : framing.frame;
}

interface MapViewerState {
  readonly map: MapViewModel | null;
  readonly arenaIndex: number;
  readonly camera: Camera;
  /** The viewer's size (the view and its bars), and device pixels per CSS pixel. */
  readonly host: Viewport;
  /** The camera has been placed over the shown arena (it needs the viewer's size first). */
  readonly placed: boolean;
  readonly bars: MapViewerBars;
}

/**
 * The viewer's own UI state, one per viewer (provided by {@link MapViewer}; a presenter store):
 * the map it was given, the arena, the camera, the viewer's size, the view inside it, and the
 * pack's layer stack. The layers inside the viewer read it.
 *
 * In order: zoomed out all the way, the view shows the whole playable area (the camera bounds),
 * centred; then as much of the map round it as it can (a margin of up to PLAYABLE_MARGIN); and
 * never an edge of the sky (PACK.md, Sky layers fill their rectangles). The margin shrinks as far as
 * the sky needs; only when even no margin isn't filled is the view narrowed, and the rest of the
 * viewer bars: one pair, the same thickness (`bars`: fixed, or receding as the camera zooms in).
 * The camera is kept to what the view shows zoomed out all the way (so there it can't move at all),
 * and where the sky fills the view drawn at its zoom.
 */
export const MapViewerStore = signalStore(
  withState<MapViewerState>({
    map: null,
    arenaIndex: 0,
    camera: { cx: 0, cy: 0, zoom: 1 },
    host: { width: 0, height: 0, dpr: 1 },
    placed: false,
    bars: 'fixed',
  }),
  withComputed(({ map, arenaIndex, host }) => {
    const arenas = computed(() => {
      const m = map();
      return m ? arenasOf(m.pack) : [];
    });
    const arena = computed(() => arenas()[arenaIndex()] ?? arenas()[0] ?? null);
    /** The pack's sky layers, whose pictures must fill the view. */
    const sky = computed(() => {
      const m = map();
      return m ? m.pack.layers.filter((l): l is PackParallaxLayer => l.kind === 'parallax') : [];
    });
    /** What the framing works from: the playable area, the map's scale, the sky. */
    const scene = computed((): FramingScene | null => {
      const a = arena();
      return a
        ? { bounds: a.bounds, mapPxPerCell: a.layer.pxPerCell, layers: sky(), anchor: a.skyAnchor }
        : null;
    });
    /**
     * The view zoomed out all the way (in the viewer's CSS pixels: all of it, or less, with bars),
     * and the playable area with the margin it gets.
     */
    const framing = computed((): Framing | null => {
      const sc = scene();
      return sc ? viewInside(host(), sc) : null;
    });
    /**
     * What the view zoomed out all the way shows (the playable area, its margin, and more along a
     * side with room to spare): the camera is kept to it, so zoomed out all the way it can't move.
     */
    const area = computed(() => framing()?.footprint ?? null);
    const limitFrame = computed((): ScreenBox => {
      const h = host();
      return framing()?.frame ?? { x: 0, y: 0, w: h.width, h: h.height };
    });
    return {
      arenas,
      arena,
      sky,
      area,
      scene,
      framing,
      limitFrame,
      /** The pack's own layers: their order and parallax rate, back to front. */
      stack: computed(() => {
        const m = map();
        return m ? packStack(m.pack) : [];
      }),
      /** The furthest out the camera may go: the whole playable area and its margin in view. */
      minZoom: computed(() => {
        const a = arena();
        const shown = area();
        const f = limitFrame();
        return a && shown
          ? fitCells(shown, { width: f.w, height: f.h, dpr: 1 }, a.layer.pxPerCell)
          : 0;
      }),
    };
  }),
  withComputed((store) => {
    /** The view as drawn, at the camera's zoom. */
    const frame = computed((): ScreenBox => {
      const framing = store.framing();
      return framing && store.placed()
        ? viewAt(store.camera().zoom, framing, store.bars(), store.host(), store.scene())
        : store.limitFrame();
    });
    /** The view's size: what the layers draw. */
    const viewport = computed((): Viewport => ({
      width: frame().w,
      height: frame().h,
      dpr: store.host().dpr,
    }));
    return {
      frame,
      viewport,
      /** What there is to draw; `null` until there is a pack, a size and a camera. */
      view: computed((): MapView | null => {
        const m = store.map();
        const a = store.arena();
        return m && a && store.placed()
          ? { map: m, arena: a, camera: store.camera(), viewport: viewport() }
          : null;
      }),
    };
  }),
  withMethods((store) => {
    /** A camera kept to the playable area and where the sky fills the view drawn at its zoom. */
    function kept(camera: Camera): Camera {
      const arena = store.arena();
      const area = store.area();
      const framing = store.framing();
      if (!arena || !area || !framing) return camera;
      const frame = viewAt(camera.zoom, framing, store.bars(), store.host(), store.scene());
      const viewport = { width: frame.w, height: frame.h, dpr: store.host().dpr };
      const inArea = keptInArea(camera, area, viewport, arena.layer.pxPerCell);
      return keptInSky(inArea, viewport, store.sky(), arena.skyAnchor);
    }
    /** The camera zoomed out all the way, centred on the playable area, once the viewer has a size. */
    function place(): void {
      const area = store.area();
      const frame = store.limitFrame();
      if (!store.arena() || !area || frame.w <= 0 || frame.h <= 0) return;
      const camera = {
        cx: (area.left + area.right) / 2,
        cy: (area.bottom + area.top) / 2,
        zoom: store.minZoom(),
      };
      patchState(store, { camera: kept(camera), placed: true });
    }
    function move(camera: Camera): void {
      if (store.arena() && store.placed()) patchState(store, { camera: kept(camera) });
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
      /** Back to the whole playable area. */
      recentre(): void {
        patchState(store, { placed: false });
        place();
      },
      /** How the bars behave as the camera zooms in. */
      setBars(bars: MapViewerBars): void {
        patchState(store, { bars });
        move(store.camera());
      },
      /** The viewer's size changed. */
      resize(host: Viewport): void {
        patchState(store, { host });
        if (!store.placed()) place();
        else {
          const camera = store.camera();
          move({ ...camera, zoom: Math.max(camera.zoom, store.minZoom()) });
        }
      },
      /** A drag of (dx, dy) view pixels. */
      panBy(dx: number, dy: number): void {
        const arena = store.arena();
        if (arena) move(panBy(store.camera(), arena.layer.pxPerCell, dx, dy));
      },
      /** Zoom by a factor about a point of the view. */
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
