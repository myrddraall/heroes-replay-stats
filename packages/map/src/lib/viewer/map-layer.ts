import type { MapViewModel } from '../pack/map-assets';
import type { Arena } from '../view/arenas';
import type { Camera, LayerProjection, ViewPoint, Viewport } from '../view/camera';
import type { LayerPlacement } from '../view/layer-stack';

/** What the viewer shows: the map, the arena shown, and the camera over it. */
export interface MapView {
  readonly map: MapViewModel;
  readonly arena: Arena;
  readonly camera: Camera;
  readonly viewport: Viewport;
}

/** One frame being drawn. */
export interface MapFrame extends MapView {
  /** Counts up by one each frame. */
  readonly number: number;
  /** `performance.now()` when the frame started. */
  readonly now: number;
}

/** A frame as one layer gets it: with its placement, and the projection of its rate. */
export interface LayerFrame extends MapFrame {
  readonly placement: LayerPlacement;
  readonly projection: LayerProjection;
}

/** How a layer's drawing went. */
export interface MapLayerStatus {
  /** Everything it needs for this view is loaded. */
  readonly complete: boolean;
  /** It is in the middle of an animation (a tile fading in): draw another frame. */
  readonly animating: boolean;
}

export const LAYER_DONE: MapLayerStatus = { complete: true, animating: false };

/**
 * A layer of the viewer. Each one registers with the viewer's {@link MapRenderer}, which stacks
 * them by their placement's order (the element's `z-index`), draws them back to front each frame
 * with the projection of their rate, and hands them the pointer front to back. A layer directive
 * composes {@link MapLayerPlacement} for its `order` and `rate` inputs.
 */
export interface MapLayer {
  /** The layer's element: the renderer sets its `z-index`. */
  readonly element: HTMLElement;
  placement(): LayerPlacement;
  /** Draws the layer for this frame. */
  render(frame: LayerFrame): MapLayerStatus;
  /**
   * The pointer is over a point (`null`: over nothing of this layer's, or gone). Returns whether
   * the layer has something there that a click acts on; the layers behind it then get `null`.
   */
  hover?(frame: LayerFrame, point: ViewPoint | null): boolean;
  /** A click at a point. Returns whether the layer acted on it; the layers behind it don't get it. */
  click?(frame: LayerFrame, point: ViewPoint): boolean;
}
