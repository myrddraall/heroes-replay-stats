import { describe, expect, it } from 'vitest';
import type { PackMapLayer, PackParallaxLayer } from '../src/lib/pack/map-pack';
import { arenasOf } from '../src/lib/view/arenas';
import {
  cellToMapPixel,
  clampCamera,
  fitZoom,
  layerScale,
  mapPixelToCell,
  MAX_ZOOM,
  middlePixel,
  panBy,
  projection,
  screenBox,
  tileLevel,
  zoomAbout,
} from '../src/lib/view/camera';
import { fixturePack } from './fixtures';

const pack = fixturePack('battlefield-of-eternity');
const map = pack.layers.find((l): l is PackMapLayer => l.kind === 'map')!;
const haze = pack.layers.find((l): l is PackParallaxLayer => l.id === 'haze')!;
const viewport = { width: 1600, height: 900, dpr: 1 };

describe('layer placement (PACK.md, Layers and drawing)', () => {
  it('scales the map by the zoom, and a layer further back less', () => {
    expect(layerScale(1, 0.25)).toBeCloseTo(0.25);
    expect(layerScale(haze.rate, 0.25)).toBeGreaterThan(0.25);
    expect(layerScale(haze.rate, 1)).toBe(1);
  });

  it("puts the map's origin cell at its top-left pixel", () => {
    const [cx, cy] = map.originCell;
    expect(middlePixel(map, { cx, cy, zoom: 1 }, null)).toEqual([0, 0]);
    expect(middlePixel(map, { cx: cx + 1, cy: cy - 2, zoom: 1 }, null)).toEqual([
      map.pxPerCell,
      2 * map.pxPerCell,
    ]);
  });

  it("puts a sky layer's centre pixel at its centre cell, or at the arena's anchor", () => {
    const [cx, cy] = haze.centreCell;
    expect(middlePixel(haze, { cx, cy, zoom: 1 }, null)).toEqual([...haze.centrePixel]);
    const anchored = middlePixel(haze, { cx, cy, zoom: 1 }, [cx - 10, cy]);
    expect(anchored[0]).toBeCloseTo(haze.centrePixel[0] + 10 * haze.pxPerCell);
  });

  it('chooses the level whose pixels are about one device pixel', () => {
    expect(tileLevel(6, 1, 1)).toBe(5);
    expect(tileLevel(6, 0.5, 1)).toBe(4);
    expect(tileLevel(6, 0.5, 2)).toBe(5);
    expect(tileLevel(6, 0.001, 1)).toBe(0);
    expect(tileLevel(6, 4, 1)).toBe(5);
  });

  it('snaps boxes to device pixels', () => {
    const middle: [number, number] = [1000.3, 500.7];
    const box = screenBox({ ...viewport, dpr: 2 }, middle, 0.5, 1000, 500, 100, 50);
    expect(box.x * 2).toBe(Math.round(box.x * 2));
    expect(box.w).toBeCloseTo(50, 0);
  });
});

describe('camera', () => {
  const arena = arenasOf(pack)[0]!;

  it('fits the whole arena in the viewport', () => {
    const zoom = fitZoom(arena, viewport);
    const width = (arena.east - arena.west) * map.pxPerCell * zoom;
    const height = (arena.north - arena.south) * map.pxPerCell * zoom;
    expect(Math.max(width / viewport.width, height / viewport.height)).toBeCloseTo(1);
  });

  it('keeps the camera inside the bounds', () => {
    const b = arena.bounds;
    expect(clampCamera({ cx: -100, cy: 1000, zoom: 1 }, b)).toEqual({
      cx: b.left,
      cy: b.top,
      zoom: 1,
    });
  });

  it('pans with the pointer: dragging right moves the camera west', () => {
    const moved = panBy({ cx: 100, cy: 100, zoom: 0.5 }, map.pxPerCell, map.pxPerCell, 0);
    expect(moved.cx).toBeCloseTo(98);
    expect(moved.cy).toBe(100);
  });

  it('zooms about a point, keeping the cell under it there, within the limits', () => {
    const camera = { cx: 100, cy: 100, zoom: 0.5 };
    const point = { x: 1200, y: 300 };
    const cellAt = (c: typeof camera) => [
      c.cx + (point.x - viewport.width / 2) / (c.zoom * map.pxPerCell),
      c.cy - (point.y - viewport.height / 2) / (c.zoom * map.pxPerCell),
    ];
    const zoomed = zoomAbout(camera, viewport, map.pxPerCell, point, 1.5, 0.1);
    expect(zoomed.zoom).toBeCloseTo(0.75);
    expect(cellAt(zoomed)[0]).toBeCloseTo(cellAt(camera)[0]!);
    expect(cellAt(zoomed)[1]).toBeCloseTo(cellAt(camera)[1]!);
    expect(zoomAbout(camera, viewport, map.pxPerCell, point, 100, 0.1).zoom).toBe(MAX_ZOOM);
    expect(zoomAbout(camera, viewport, map.pxPerCell, point, 0.001, 0.1).zoom).toBe(0.1);
  });
});

describe('projection', () => {
  const camera = { cx: 120, cy: 100, zoom: 0.4 };
  const cell = [131.5, 92.25] as const;

  it('at rate 1 places a cell where the map layer draws it', () => {
    const p = projection(camera, viewport, map.pxPerCell, 1);
    const middle = middlePixel(map, camera, null);
    const [px, py] = cellToMapPixel(map, cell);
    expect(p.scale).toBeCloseTo(camera.zoom);
    expect(p.toScreen(cell).x).toBeCloseTo(viewport.width / 2 + (px - middle[0]) * camera.zoom);
    expect(p.toScreen(cell).y).toBeCloseTo(viewport.height / 2 + (py - middle[1]) * camera.zoom);
    const [x, y] = p.toCell(p.toScreen(cell))!;
    expect(x).toBeCloseTo(cell[0]);
    expect(y).toBeCloseTo(cell[1]);
  });

  it("at a sky layer's rate places a cell where that layer draws it", () => {
    const p = projection(camera, viewport, map.pxPerCell, haze.rate);
    const middle = middlePixel(haze, camera, null);
    const scale = layerScale(haze.rate, camera.zoom);
    const pixel = [
      haze.centrePixel[0] + haze.pxPerCell * (cell[0] - haze.centreCell[0]),
      haze.centrePixel[1] - haze.pxPerCell * (cell[1] - haze.centreCell[1]),
    ];
    // the sky's pixels per cell are its rate times the map's, to the pack's rounding
    expect(p.toScreen(cell).x).toBeCloseTo(viewport.width / 2 + (pixel[0]! - middle[0]) * scale, 0);
    expect(p.toScreen(cell).y).toBeCloseTo(
      viewport.height / 2 + (pixel[1]! - middle[1]) * scale,
      0,
    );
  });

  it('at rate 0 is fixed to the screen', () => {
    const p = projection(camera, viewport, map.pxPerCell, 0);
    expect(p.scale).toBe(1);
    expect(p.toScreen(cell)).toEqual({ x: viewport.width / 2, y: viewport.height / 2 });
    expect(p.toCell({ x: 10, y: 10 })).toBeNull();
  });

  it('converts between map pixels and cells', () => {
    const [px, py] = cellToMapPixel(map, cell);
    const [x, y] = mapPixelToCell(map, px, py);
    expect(x).toBeCloseTo(cell[0]);
    expect(y).toBeCloseTo(cell[1]);
  });
});

describe('middlePixel at another rate', () => {
  it("covers a sky layer's picture faster at a higher rate, the same at its own", () => {
    const camera = { cx: haze.centreCell[0] + 10, cy: haze.centreCell[1], zoom: 1 };
    expect(middlePixel(haze, camera, null, haze.rate)).toEqual(middlePixel(haze, camera, null));
    const faster = middlePixel(haze, camera, null, haze.rate * 2);
    expect(faster[0] - haze.centrePixel[0]).toBeCloseTo(20 * haze.pxPerCell);
  });
});
