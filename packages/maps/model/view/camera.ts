import type { Cell, PackMapLayer, TilePackLayer } from '../pack/map-pack';

/** The camera: the map cell at the window's middle, and the window's pixels per map pixel. */
export interface Camera {
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
}

/** The viewer's size in CSS pixels, and device pixels per CSS pixel. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
}

/** A point in the viewer, in CSS pixels from its top-left corner. */
export interface ViewPoint {
  readonly x: number;
  readonly y: number;
}

/** The furthest in: two screen pixels per map pixel. */
export const MAX_ZOOM = 2;
/** A layer's window pixels per layer pixel at a zoom (PACK.md, Layers and drawing). */
export function layerScale(rate: number, zoom: number): number {
  return 1 / (1 + rate * (1 / zoom - 1));
}

/**
 * The pixel of a layer that belongs at the window's middle. A sky layer is anchored to the
 * arena's middle on a map of several arenas, to its own centre cell otherwise. A sky layer moved
 * at another `rate` than its own covers its picture faster or slower; the terrain's pixels are
 * the camera's, whatever the rate.
 */
export function middlePixel(
  layer: TilePackLayer,
  camera: Camera,
  skyAnchor: readonly [number, number] | null,
  rate = layer.rate,
): [number, number] {
  if (layer.kind === 'map') {
    return [
      (camera.cx - layer.originCell[0]) * layer.pxPerCell,
      (layer.originCell[1] - camera.cy) * layer.pxPerCell,
    ];
  }
  const [ox, oy] = skyAnchor ?? layer.centreCell;
  const pxPerCell = layer.rate > 0 ? (layer.pxPerCell * rate) / layer.rate : layer.pxPerCell;
  return [
    layer.centrePixel[0] + pxPerCell * (camera.cx - ox),
    layer.centrePixel[1] - pxPerCell * (camera.cy - oy),
  ];
}

/**
 * How a plane moving at a parallax rate lies on the screen: PACK.md's layer placement, for map
 * cells. At rate 1 it is the map's, at a sky layer's rate that layer's, at rate 0 it is fixed to
 * the screen.
 */
export interface LayerProjection {
  readonly rate: number;
  /** Window pixels per pixel of a picture drawn on the plane at its own scale. */
  readonly scale: number;
  /** Window pixels per map cell on the plane. */
  readonly cellScale: number;
  /** Where a map cell on the plane is in the viewer. */
  toScreen(cell: Cell): ViewPoint;
  /** The map cell on the plane under a point of the viewer; `null` at rate 0 (none: it doesn't move). */
  toCell(point: ViewPoint): [number, number] | null;
}

/** The projection of a plane at a rate, for the camera, viewport and the map's pixels per cell. */
export function projection(
  camera: Camera,
  viewport: Viewport,
  mapPxPerCell: number,
  rate: number,
): LayerProjection {
  const scale = layerScale(rate, camera.zoom);
  const cellScale = scale * rate * mapPxPerCell;
  return {
    rate,
    scale,
    cellScale,
    toScreen: ([x, y]) => ({
      x: viewport.width / 2 + (x - camera.cx) * cellScale,
      y: viewport.height / 2 - (y - camera.cy) * cellScale,
    }),
    toCell: (point) =>
      cellScale === 0
        ? null
        : [
            camera.cx + (point.x - viewport.width / 2) / cellScale,
            camera.cy - (point.y - viewport.height / 2) / cellScale,
          ],
  };
}

/** The map cell at a pixel of a map layer. */
export function mapPixelToCell(layer: PackMapLayer, px: number, py: number): [number, number] {
  return [layer.originCell[0] + px / layer.pxPerCell, layer.originCell[1] - py / layer.pxPerCell];
}

/** The pixel of a map layer at a map cell. */
export function cellToMapPixel(layer: PackMapLayer, [x, y]: Cell): [number, number] {
  return [(x - layer.originCell[0]) * layer.pxPerCell, (layer.originCell[1] - y) * layer.pxPerCell];
}

/** The pyramid level whose pixels are about one device pixel at a scale. */
export function tileLevel(levels: number, scale: number, dpr: number): number {
  const level = levels - 1 - Math.floor(Math.log2(1 / (scale * dpr)));
  return Math.max(0, Math.min(levels - 1, level));
}

/** The camera moved by a drag of (dx, dy) window pixels: the map follows the pointer. */
export function panBy(camera: Camera, pxPerCell: number, dx: number, dy: number): Camera {
  const cells = camera.zoom * pxPerCell;
  return { cx: camera.cx - dx / cells, cy: camera.cy + dy / cells, zoom: camera.zoom };
}

/**
 * The camera zoomed by a factor about a point of the viewer: the map cell under the point stays
 * under it. The zoom stays between `minZoom` and {@link MAX_ZOOM}.
 */
export function zoomAbout(
  camera: Camera,
  viewport: Viewport,
  pxPerCell: number,
  point: ViewPoint,
  factor: number,
  minZoom: number,
): Camera {
  const dx = point.x - viewport.width / 2;
  const dy = point.y - viewport.height / 2;
  const ux = camera.cx + dx / (camera.zoom * pxPerCell);
  const uy = camera.cy - dy / (camera.zoom * pxPerCell);
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom, camera.zoom * factor));
  return { cx: ux - dx / (zoom * pxPerCell), cy: uy + dy / (zoom * pxPerCell), zoom };
}

/** A value rounded to whole device pixels, so neighbouring tiles meet without hairline gaps. */
export function snap(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}

/** A rectangle in the window, in CSS pixels. */
export interface ScreenBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The box between two points of the viewer, its edges on whole device pixels. */
export function snappedBox(topLeft: ViewPoint, bottomRight: ViewPoint, dpr: number): ScreenBox {
  const x = snap(topLeft.x, dpr);
  const y = snap(topLeft.y, dpr);
  return { x, y, w: snap(bottomRight.x, dpr) - x, h: snap(bottomRight.y, dpr) - y };
}

/**
 * Where a rectangle of layer pixels lands in the viewer, its edges on whole device pixels: the
 * layer at `scale`, its pixel `middle` at the viewer's middle.
 */
export function screenBox(
  viewport: Viewport,
  middle: readonly [number, number],
  scale: number,
  left: number,
  top: number,
  width: number,
  height: number,
): ScreenBox {
  const { dpr } = viewport;
  const x = snap(viewport.width / 2 + (left - middle[0]) * scale, dpr);
  const y = snap(viewport.height / 2 + (top - middle[1]) * scale, dpr);
  return {
    x,
    y,
    w: snap(viewport.width / 2 + (left + width - middle[0]) * scale, dpr) - x,
    h: snap(viewport.height / 2 + (top + height - middle[1]) * scale, dpr) - y,
  };
}
