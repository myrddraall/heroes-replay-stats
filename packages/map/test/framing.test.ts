import { describe, expect, it } from 'vitest';
import type { CellBounds, PackParallaxLayer } from '../src/lib/pack/map-pack';
import { arenasOf, type Arena } from '../src/lib/view/arenas';
import {
  layerScale,
  middlePixel,
  type Camera,
  type ScreenBox,
  type Viewport,
} from '../src/lib/view/camera';
import {
  fitCells,
  keptInArea,
  keptInSky,
  playableArea,
  PLAYABLE_MARGIN,
  viewAtZoom,
  viewInside,
  type FramingScene,
} from '../src/lib/view/framing';
import { fixturePack } from './fixtures';

const pack = fixturePack('battlefield-of-eternity');
const sky = pack.layers.filter((l): l is PackParallaxLayer => l.kind === 'parallax');
const arena = arenasOf(pack)[0]!;
const ppc = arena.layer.pxPerCell;
const scene: FramingScene = { bounds: arena.bounds, mapPxPerCell: ppc, layers: sky, anchor: null };

/** Whether every sky layer fills a viewport, worked out as the layers are drawn (PACK.md). */
function skyFills(
  layers: readonly PackParallaxLayer[],
  camera: Camera,
  viewport: Viewport,
  a: Arena,
): boolean {
  return layers.every((layer) => {
    const scale = layerScale(layer.rate, camera.zoom);
    const [u, v] = middlePixel(layer, camera, a.skyAnchor);
    const halfW = viewport.width / (2 * scale);
    const halfH = viewport.height / (2 * scale);
    const [w, h] = layer.size;
    return (
      u - halfW >= -1e-6 && u + halfW <= w + 1e-6 && v - halfH >= -1e-6 && v + halfH <= h + 1e-6
    );
  });
}

/** Whether a viewport shows all of an area. */
function shows(camera: Camera, viewport: Viewport, shown: CellBounds, scale = ppc): boolean {
  const halfW = viewport.width / (2 * camera.zoom * scale);
  const halfH = viewport.height / (2 * camera.zoom * scale);
  return (
    camera.cx - halfW <= shown.left + 1e-6 &&
    camera.cx + halfW >= shown.right - 1e-6 &&
    camera.cy - halfH <= shown.bottom + 1e-6 &&
    camera.cy + halfH >= shown.top - 1e-6
  );
}

const size = (box: ScreenBox): Viewport => ({ width: box.w, height: box.h, dpr: 1 });

/** The camera zoomed out all the way in a view, centred on an area. */
function centredOut(view: Viewport, shown: CellBounds, scale = ppc): Camera {
  return {
    cx: (shown.left + shown.right) / 2,
    cy: (shown.bottom + shown.top) / 2,
    zoom: fitCells(shown, view, scale),
  };
}

/** A camera kept as the viewer keeps it, in a view, to an area. */
function kept(
  camera: Camera,
  view: Viewport,
  shown: CellBounds,
  a: Arena,
  layers: readonly PackParallaxLayer[],
): Camera {
  return keptInSky(keptInArea(camera, shown, view, a.layer.pxPerCell), view, layers, a.skyAnchor);
}

/** The share of the playable area's size its margin is, on each side. */
function marginOf(shown: CellBounds, bounds: CellBounds): number {
  return (bounds.left - shown.left) / (bounds.right - bounds.left);
}

describe('the playable area', () => {
  it('gets a margin of a tenth of its size on every side at most', () => {
    const b = arena.bounds;
    const area = playableArea(b);
    expect(PLAYABLE_MARGIN).toBe(0.1);
    expect(area.left).toBeCloseTo(b.left - 0.1 * (b.right - b.left));
    expect(area.top).toBeCloseTo(b.top + 0.1 * (b.top - b.bottom));
  });

  it('just fits the viewport at the zoom that fits it', () => {
    const area = playableArea(arena.bounds);
    const viewport = { width: 1600, height: 900, dpr: 1 };
    const zoom = fitCells(area, viewport, ppc);
    const width = (area.right - area.left) * ppc * zoom;
    const height = (area.top - area.bottom) * ppc * zoom;
    expect(Math.max(width / 1600, height / 900)).toBeCloseTo(1);
  });

  it('stays all in view and centred zoomed out; zoomed in, holds the view inside it', () => {
    const area = playableArea(arena.bounds);
    const viewport = { width: 1600, height: 900, dpr: 1 };
    const out = keptInArea(
      { cx: -500, cy: 500, zoom: fitCells(area, viewport, ppc) },
      area,
      viewport,
      ppc,
    );
    expect(shows(out, viewport, area)).toBe(true);
    expect(out.cy).toBeCloseTo((area.bottom + area.top) / 2); // the tight axis: centred
    const zoomedIn = keptInArea({ cx: -500, cy: 500, zoom: 1 }, area, viewport, ppc);
    expect(zoomedIn.cx - viewport.width / (2 * ppc)).toBeCloseTo(area.left);
    expect(zoomedIn.cy + viewport.height / (2 * ppc)).toBeCloseTo(area.top);
  });
});

describe('the view zoomed out all the way', () => {
  for (const [width, height] of [
    [1100, 690],
    [1600, 900],
    [1920, 1080],
    [2400, 700],
    [3440, 1300],
    [700, 1600],
  ] as const) {
    it(`in a ${width}x${height} viewer: the playable area centred, as much margin as the sky allows, no sky edge`, () => {
      const host = { width, height, dpr: 1 };
      const { frame: box, area } = viewInside(host, scene);
      const view = size(box);
      const camera = centredOut(view, area);
      // 1. The whole playable area, centred.
      expect(shows(camera, view, arena.bounds)).toBe(true);
      expect(kept(camera, view, area, arena, sky)).toEqual(camera); // the viewer leaves it there
      // Never an edge of the sky.
      expect(skyFills(sky, camera, view, arena)).toBe(true);
      // 2. As much of the map round it as it can: a bigger margin would show the sky's edge.
      const margin = marginOf(area, arena.bounds);
      expect(margin).toBeGreaterThanOrEqual(0);
      expect(margin).toBeLessThanOrEqual(PLAYABLE_MARGIN + 1e-9);
      if (margin < PLAYABLE_MARGIN - 1e-3) {
        const more = playableArea(arena.bounds, margin + 0.005);
        expect(skyFills(sky, centredOut(view, more), view, arena)).toBe(false);
      }
      // Bars only when even no margin is filled; one pair, the same thickness either side.
      if (box.x > 0 || box.y > 0) expect(margin).toBe(0);
      expect(box.x === 0 || box.y === 0).toBe(true);
      expect(2 * box.x + box.w).toBe(width);
      expect(2 * box.y + box.h).toBe(height);
    });
  }

  for (const [width, height] of [
    [1100, 690],
    [2400, 700],
    [700, 1600],
  ] as const) {
    it(`in a ${width}x${height} viewer: can't be panned at all zoomed out; zoomed in, can`, () => {
      const host = { width, height, dpr: 1 };
      const { frame: box, area, footprint } = viewInside(host, scene);
      const view = size(box);
      const zoom = fitCells(area, view, ppc);
      const middle = { cx: (area.left + area.right) / 2, cy: (area.bottom + area.top) / 2, zoom };
      for (const [cx, cy] of [
        [-1000, -1000],
        [1000, 1000],
        [0, 300],
      ] as const) {
        const camera = kept({ cx, cy, zoom }, view, footprint, arena, sky);
        expect(camera.cx).toBeCloseTo(middle.cx, 6);
        expect(camera.cy).toBeCloseTo(middle.cy, 6);
      }
      const zoomedIn = kept({ cx: -1000, cy: -1000, zoom: zoom * 2 }, view, footprint, arena, sky);
      expect(zoomedIn.cx).toBeLessThan(middle.cx - 1);
      expect(zoomedIn.cy).toBeLessThan(middle.cy - 1);
    });
  }

  it("anchors the sky to the shown arena's middle on a map of several", () => {
    const punisher = fixturePack('punisher-arena');
    const layers = punisher.layers.filter((l): l is PackParallaxLayer => l.kind === 'parallax');
    for (const a of arenasOf(punisher)) {
      const { frame: box, area } = viewInside(
        { width: 1600, height: 900, dpr: 1 },
        { bounds: a.bounds, mapPxPerCell: a.layer.pxPerCell, layers, anchor: a.skyAnchor },
      );
      const camera = centredOut(size(box), area, a.layer.pxPerCell);
      expect(shows(camera, size(box), a.bounds, a.layer.pxPerCell)).toBe(true);
      expect(skyFills(layers, camera, size(box), a)).toBe(true);
    }
  });

  it('has bars, one pair of the same thickness, where no margin is left and the sky still runs out', () => {
    // Sky pictures cut short below their middle: a wide viewer must be narrowed or shortened.
    const short = sky.map((l) => ({ ...l, size: [l.size[0], l.centrePixel[1] + 2000] as const }));
    const host = { width: 3440, height: 1300, dpr: 1 };
    const { frame: box, area } = viewInside(host, { ...scene, layers: short });
    expect(marginOf(area, arena.bounds)).toBe(0);
    expect(box.x > 0 || box.y > 0).toBe(true);
    expect(box.x === 0 || box.y === 0).toBe(true);
    expect(2 * box.x + box.w).toBe(host.width);
    expect(2 * box.y + box.h).toBe(host.height);
    const camera = centredOut(size(box), area);
    expect(shows(camera, size(box), arena.bounds)).toBe(true);
    expect(skyFills(short, camera, size(box), arena)).toBe(true);
  });

  it('is the whole viewer with the whole margin, and changes no camera, for a pack without sky layers', () => {
    const host = { width: 3440, height: 900, dpr: 1 };
    const { frame, area } = viewInside(host, { ...scene, layers: [] });
    expect(frame).toEqual({ x: 0, y: 0, w: 3440, h: 900 });
    expect(marginOf(area, arena.bounds)).toBeCloseTo(PLAYABLE_MARGIN);
    const camera = { cx: 1, cy: 2, zoom: 0.5 };
    expect(keptInSky(camera, host, [], null)).toBe(camera);
  });
});

describe('receding bars', () => {
  it('narrow with the zoom alone, and the sky fills the view wherever the camera is panned', () => {
    const short = sky.map((l) => ({ ...l, size: [l.size[0], l.centrePixel[1] + 2000] as const }));
    const shortScene = { ...scene, layers: short };
    const host = { width: 3440, height: 1300, dpr: 1 };
    const framing = viewInside(host, shortScene);
    const base = framing.frame;
    const footprint = framing.footprint;
    expect(base.x > 0 || base.y > 0).toBe(true); // this viewer needs bars
    const out = centredOut(size(base), framing.area);
    let previous = 0;
    for (const factor of [1, 1.2, 1.5, 2, 3, 5, 8]) {
      const zoom = out.zoom * factor;
      const view = viewAtZoom(zoom, framing, host, shortScene);
      expect(view.w).toBeGreaterThanOrEqual(base.w);
      expect(view.h).toBeGreaterThanOrEqual(base.h);
      expect(2 * view.x + view.w).toBe(host.width);
      expect(2 * view.y + view.h).toBe(host.height);
      expect(view.w * view.h).toBeGreaterThanOrEqual(previous);
      previous = view.w * view.h;
      for (const [cx, cy] of [
        [-1000, -1000],
        [1000, 1000],
        [arena.bounds.left, arena.bounds.top],
        [124, 103],
      ] as const) {
        const camera = kept({ cx, cy, zoom }, size(view), footprint, arena, short);
        expect(skyFills(short, camera, size(view), arena)).toBe(true);
      }
    }
    expect(previous).toBe(host.width * host.height); // zoomed in far enough, no bars at all
  });
});
