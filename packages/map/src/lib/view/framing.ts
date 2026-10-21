import type { Cell, CellBounds, PackParallaxLayer } from '../pack/map-pack';
import { layerScale, type Camera, type ScreenBox, type Viewport } from './camera';

/**
 * The space round the playable area at the furthest out, as a share of its size on each side: at
 * most this, less where the sky runs out for the viewer's size (viewInside).
 */
export const PLAYABLE_MARGIN = 0.1;
/** Steps in the first search for the biggest view the sky fills, then halvings to refine it. */
const SIZE_STEPS = 100;
const SIZE_HALVINGS = 20;

/** A range of camera positions along one axis; empty when `lo > hi`. */
type Range = readonly [lo: number, hi: number];

const EVERYWHERE: Range = [-Infinity, Infinity];
const NOWHERE: Range = [Infinity, -Infinity];

function intersect(ranges: readonly Range[]): Range {
  return ranges.reduce<Range>(([lo, hi], [l, h]) => [Math.max(lo, l), Math.min(hi, h)], EVERYWHERE);
}

function clamp(value: number, [lo, hi]: Range): number {
  return Math.min(hi, Math.max(lo, value));
}

/** The playable area (the camera bounds) with its margin on every side. */
export function playableArea(bounds: CellBounds, margin = PLAYABLE_MARGIN): CellBounds {
  const x = (bounds.right - bounds.left) * margin;
  const y = (bounds.top - bounds.bottom) * margin;
  return {
    left: bounds.left - x,
    right: bounds.right + x,
    bottom: bounds.bottom - y,
    top: bounds.top + y,
  };
}

/** The zoom at which an area of map cells just fits a viewport. */
export function fitCells(area: CellBounds, viewport: Viewport, mapPxPerCell: number): number {
  return Math.min(
    viewport.width / ((area.right - area.left) * mapPxPerCell),
    viewport.height / ((area.top - area.bottom) * mapPxPerCell),
  );
}

/**
 * Where the camera may be on one axis, for a view `half` cells either side of it: while the view
 * is bigger than the area (`lo`..`hi`), all of the area stays in view; while it is smaller, the view
 * stays inside the area. Zoomed out all the way the view is the area along one axis: the camera is
 * at its middle.
 */
function areaRange(half: number, lo: number, hi: number): Range {
  return [Math.min(hi - half, lo + half), Math.max(lo + half, hi - half)];
}

/**
 * The camera kept to an area (areaRange on each axis): the viewer keeps it to the footprint of the
 * view zoomed out all the way (Framing), so zoomed out all the way it can't move at all.
 */
export function keptInArea(
  camera: Camera,
  area: CellBounds,
  viewport: Viewport,
  mapPxPerCell: number,
): Camera {
  const halfW = viewport.width / (2 * camera.zoom * mapPxPerCell);
  const halfH = viewport.height / (2 * camera.zoom * mapPxPerCell);
  return {
    cx: clamp(camera.cx, areaRange(halfW, area.left, area.right)),
    cy: clamp(camera.cy, areaRange(halfH, area.bottom, area.top)),
    zoom: camera.zoom,
  };
}

/**
 * Where the camera may be, at a zoom, for every sky layer's picture to fill the viewport (PACK.md,
 * Sky layers fill their rectangles): per axis, the camera positions at which the layer pixels the
 * viewport shows are inside each picture. The layer pixel at the viewport's middle is
 * `centrePixel + pxPerCell · (camera − anchor)` (y flipped), and the viewport shows half its size
 * over the layer's scale either side of it.
 */
export function skyRanges(
  zoom: number,
  viewport: Viewport,
  layers: readonly PackParallaxLayer[],
  anchor: Cell | null,
): { readonly x: Range; readonly y: Range } {
  const xs: Range[] = [];
  const ys: Range[] = [];
  for (const layer of layers) {
    const scale = layerScale(layer.rate, zoom);
    const halfW = viewport.width / (2 * scale);
    const halfH = viewport.height / (2 * scale);
    const [ox, oy] = anchor ?? layer.centreCell;
    const [cu, cv] = layer.centrePixel;
    const [w, h] = layer.size;
    const p = layer.pxPerCell;
    if (p === 0) {
      xs.push(halfW <= cu && cu <= w - halfW ? EVERYWHERE : NOWHERE);
      ys.push(halfH <= cv && cv <= h - halfH ? EVERYWHERE : NOWHERE);
      continue;
    }
    xs.push([ox + (halfW - cu) / p, ox + (w - halfW - cu) / p]);
    ys.push([oy + (cv - (h - halfH)) / p, oy + (cv - halfH) / p]);
  }
  return { x: intersect(xs), y: intersect(ys) };
}

/**
 * The camera kept where every sky layer fills the viewport: each axis moved to the nearest
 * position it allows. An axis with no such position is left as it is (the views the viewer draws
 * always have one: see {@link viewInside} and {@link viewAtZoom}).
 */
export function keptInSky(
  camera: Camera,
  viewport: Viewport,
  layers: readonly PackParallaxLayer[],
  anchor: Cell | null,
): Camera {
  if (!layers.length) return camera;
  const { x, y } = skyRanges(camera.zoom, viewport, layers, anchor);
  return {
    cx: x[0] <= x[1] ? clamp(camera.cx, x) : camera.cx,
    cy: y[0] <= y[1] ? clamp(camera.cy, y) : camera.cy,
    zoom: camera.zoom,
  };
}

/** What the framing works from: the playable area, the map's scale, the sky layers. */
export interface FramingScene {
  /** The playable area (the camera bounds). */
  readonly bounds: CellBounds;
  readonly mapPxPerCell: number;
  readonly layers: readonly PackParallaxLayer[];
  readonly anchor: Cell | null;
  /** The most margin round it (PLAYABLE_MARGIN if not given). */
  readonly margin?: number;
}

/** What the framing settles on for a viewer's size: the view, and the area it shows all of. */
export interface Framing {
  /** The view zoomed out all the way, in the viewer's CSS pixels. */
  readonly frame: ScreenBox;
  /** The playable area and the margin it gets. */
  readonly area: CellBounds;
  /**
   * What the view zoomed out all the way shows, centred on the playable area (the area and its
   * margin, and more along the side the view has room to spare): the camera is kept to it
   * (keptInArea), so zoomed out all the way it can't move, and zoomed in it goes as far as this.
   */
  readonly footprint: CellBounds;
}

/** A framing of a view and the area it fits zoomed out all the way, with that view's footprint. */
function framed(frame: ScreenBox, area: CellBounds, scene: FramingScene): Framing {
  const zoom = fitCells(area, { width: frame.w, height: frame.h, dpr: 1 }, scene.mapPxPerCell);
  const halfW = frame.w / (2 * zoom * scene.mapPxPerCell);
  const halfH = frame.h / (2 * zoom * scene.mapPxPerCell);
  const cx = (area.left + area.right) / 2;
  const cy = (area.bottom + area.top) / 2;
  const footprint = { left: cx - halfW, right: cx + halfW, bottom: cy - halfH, top: cy + halfH };
  return { frame, area, footprint };
}

/** Whether, zoomed out all the way to an area, the sky fills a view with the camera centred on it. */
function centredFills(
  width: number,
  height: number,
  area: CellBounds,
  scene: FramingScene,
): boolean {
  const viewport = { width, height, dpr: 1 };
  const zoom = fitCells(area, viewport, scene.mapPxPerCell);
  const { x, y } = skyRanges(zoom, viewport, scene.layers, scene.anchor);
  const cx = (area.left + area.right) / 2;
  const cy = (area.bottom + area.top) / 2;
  return x[0] <= cx + 1e-9 && cx <= x[1] + 1e-9 && y[0] <= cy + 1e-9 && cy <= y[1] + 1e-9;
}

/** Whether, at a zoom, the sky fills a view of a size from somewhere the camera may be. */
function fillsAt(
  zoom: number,
  width: number,
  height: number,
  area: CellBounds,
  scene: FramingScene,
): boolean {
  const viewport = { width, height, dpr: 1 };
  const halfW = width / (2 * zoom * scene.mapPxPerCell);
  const halfH = height / (2 * zoom * scene.mapPxPerCell);
  const sky = skyRanges(zoom, viewport, scene.layers, scene.anchor);
  const x = intersect([sky.x, areaRange(halfW, area.left, area.right)]);
  const y = intersect([sky.y, areaRange(halfH, area.bottom, area.top)]);
  return x[0] <= x[1] + 1e-9 && y[0] <= y[1] + 1e-9;
}

/**
 * The biggest size, from `lo` up to `hi`, at which `fits` holds: a scan down from `hi`, then
 * halvings between the first that fits and the step above it; `null` if none fits.
 */
function biggest(lo: number, hi: number, fits: (size: number) => boolean): number | null {
  if (fits(hi)) return hi;
  const step = (hi - lo) / SIZE_STEPS;
  for (let k = 1; k <= SIZE_STEPS; k++) {
    const size = hi - k * step;
    if (!fits(size)) continue;
    let ok = size;
    let bad = size + step;
    for (let j = 0; j < SIZE_HALVINGS; j++) {
      const mid = (ok + bad) / 2;
      if (fits(mid)) ok = mid;
      else bad = mid;
    }
    return ok;
  }
  return null;
}

/**
 * A box of a size centred in the viewer, in whole pixels, its middle exactly the viewer's: the two
 * bars it leaves are always the same thickness.
 */
function centred(host: Viewport, w: number, h: number): ScreenBox {
  const x = Math.max(0, Math.ceil((host.width - w) / 2)); // never bigger than asked: the sky fills it
  const y = Math.max(0, Math.ceil((host.height - h) / 2));
  return { x, y, w: host.width - 2 * x, h: host.height - 2 * y };
}

/**
 * The view zoomed out all the way, and the area it shows all of: the playable area centred, with a
 * margin round it of PLAYABLE_MARGIN, or less (both ways alike) as far as the sky needs for this
 * viewer to fill it with the camera centred. Only when even no margin isn't filled, bars: the
 * biggest view the sky fills, narrowed or shortened, centred, one pair, left and right or top and
 * bottom, each the same thickness; and when neither pair alone does (sky pictures too small for the
 * area), the area's own shape, as big as the sky fills.
 */
export function viewInside(host: Viewport, scene: FramingScene): Framing {
  const { width, height } = host;
  const most = scene.margin ?? PLAYABLE_MARGIN;
  const full = centred(host, width, height);
  if (!scene.layers.length || width <= 0 || height <= 0) {
    return framed(full, playableArea(scene.bounds, most), scene);
  }
  const withMargin = (t: number) => playableArea(scene.bounds, most * t);
  const share = biggest(0, 1, (t) => centredFills(width, height, withMargin(t), scene));
  if (share !== null) return framed(full, withMargin(share), scene);
  const area = playableArea(scene.bounds, 0);
  const fits = (w: number, h: number) => centredFills(w, h, area, scene);
  const narrower = biggest(1, width, (w) => fits(w, height));
  const shorter = biggest(1, height, (h) => fits(width, h));
  if (narrower !== null && (shorter === null || narrower * height >= width * shorter)) {
    return framed(centred(host, narrower, height), area, scene);
  }
  if (shorter !== null) return framed(centred(host, width, shorter), area, scene);
  const shape = (area.right - area.left) / (area.top - area.bottom);
  const across = Math.min(width, height * shape);
  const scale = biggest(0.01, 1, (k) => fits(across * k, (across * k) / shape)) ?? 1;
  return framed(centred(host, across * scale, (across * scale) / shape), area, scene);
}

/**
 * The view at a zoom with bars that recede as the camera zooms in: the bars of the view zoomed out
 * all the way (viewInside) narrowed to the biggest view the sky fills at that zoom from somewhere
 * the camera may be, up to the whole viewer. It depends on the zoom only: panning never changes it.
 * (Bars all round stay as they are.)
 */
export function viewAtZoom(
  zoom: number,
  framing: Framing,
  host: Viewport,
  scene: FramingScene,
): ScreenBox {
  const { frame: base, footprint } = framing;
  if (base.w < host.width && base.h === host.height) {
    const w = biggest(base.w, host.width, (size) => fillsAt(zoom, size, base.h, footprint, scene));
    return centred(host, w ?? base.w, base.h);
  }
  if (base.h < host.height && base.w === host.width) {
    const h = biggest(base.h, host.height, (size) => fillsAt(zoom, base.w, size, footprint, scene));
    return centred(host, base.w, h ?? base.h);
  }
  return base;
}
