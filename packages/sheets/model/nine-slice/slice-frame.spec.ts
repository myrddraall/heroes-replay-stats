import { describe, expect, it } from 'vitest';
import type { SheetPartPlace, SlicePart } from '../sheet/sheet-meta';
import { planFrame, sheetFrame, templateFrame, type ResolvedFrame } from './slice-frame';

const cutFrame: ResolvedFrame = {
  states: { normal: [10, 20, 100, 60], hover: [10, 90, 100, 60] },
  cuts: [12, 30, 8, 20],
};

const part = (frame: ResolvedFrame, name: SlicePart) =>
  planFrame(frame).parts.find((p) => p.part === name)!;

describe('planFrame', () => {
  it('sizes the corner cells from the cuts, scaled', () => {
    expect(planFrame(cutFrame)).toMatchObject({ columns: [20, 30], rows: [12, 8] });
    expect(planFrame({ ...cutFrame, scale: 0.5 })).toMatchObject({ columns: [10, 15], rows: [6, 4] });
  });

  it("cuts every part out of each state's picture", () => {
    expect(part(cutFrame, 'topLeft').cuts).toEqual({
      normal: { rect: [10, 20, 20, 12] },
      hover: { rect: [10, 90, 20, 12] },
    });
    expect(part(cutFrame, 'centre').cuts.normal).toEqual({ rect: [30, 32, 50, 40] });
    expect(part(cutFrame, 'bottomRight').cuts.normal).toEqual({ rect: [80, 72, 30, 8] });
  });

  it('stretches by default, and tiles at the given length or the picture’s own', () => {
    expect(part(cutFrame, 'top')).toMatchObject({ fill: 'stretch', tile: [null, null] });
    expect(part(cutFrame, 'topLeft').fill).toBe('corner');

    const tiled = { ...cutFrame, edges: 'tile', centre: 'round' } as const;
    expect(part(tiled, 'top')).toMatchObject({ fill: 'tile', tile: [50, null] });
    expect(part(tiled, 'left')).toMatchObject({ fill: 'tile', tile: [null, 40] });
    expect(part(tiled, 'centre')).toMatchObject({ fill: 'round', tile: [50, 40] });
    expect(part({ ...tiled, tile: 25 }, 'top').tile).toEqual([25, null]);
    expect(part({ ...tiled, tile: 25 }, 'centre').tile).toEqual([25, 20]);

    const mixed = { ...cutFrame, edges: { top: 'tile', left: 'space' } } as const;
    expect(part(mixed, 'top').fill).toBe('tile');
    expect(part(mixed, 'left').fill).toBe('space');
    expect(part(mixed, 'bottom').fill).toBe('stretch');
  });

  it('mirrors the right column and bottom row from the left and top', () => {
    const x = planFrame({ ...cutFrame, mirror: 'x' });
    expect(x.columns).toEqual([20, 20]);
    expect(x.parts.find((p) => p.part === 'topRight')).toMatchObject({
      cuts: { normal: { rect: [10, 20, 20, 12] } },
      flip: 'x',
    });
    const xy = planFrame({ ...cutFrame, mirror: 'xy' });
    expect(xy.rows).toEqual([12, 12]);
    expect(xy.parts.find((p) => p.part === 'bottomRight')).toMatchObject({
      cuts: { normal: { rect: [10, 20, 20, 12] } },
      flip: 'xy',
    });
    expect(xy.parts.find((p) => p.part === 'centre')!.flip).toBeNull();
  });

  it("takes a game Border's parts as placed, turning the side edges", () => {
    const s = 64;
    const row = (n: number): SheetPartPlace => ({ rect: [0, n * s, 4 * s, s] });
    const border: ResolvedFrame = {
      states: { normal: [100, 0, 256, 512] },
      edges: 'tile',
      parts: {
        topLeft: { rect: [0, 0, s, s] },
        topRight: { rect: [s, 0, s, s] },
        bottomLeft: { rect: [2 * s, 0, s, s] },
        bottomRight: { rect: [3 * s, 0, s, s] },
        top: row(1),
        bottom: row(2),
        right: { ...row(3), rotate: 90 },
        left: { ...row(4), rotate: 90 },
        centre: { rect: [0, 5 * s, s, s] },
      },
    };
    const plan = planFrame(border);
    expect(plan).toMatchObject({ columns: [64, 64], rows: [64, 64] });
    expect(part(border, 'right')).toMatchObject({
      cuts: { normal: { rect: [100, 192, 256, 64], rotate: 90 } },
      tile: [null, 256],
    });
    expect(part(border, 'top').tile).toEqual([256, null]);
  });

  it('needs cuts or parts', () => {
    expect(() => planFrame({ states: { normal: [0, 0, 10, 10] } })).toThrow();
  });
});

describe('sheetFrame and templateFrame', () => {
  it("keeps a sheet frame's known states and options", () => {
    const frame = sheetFrame({
      states: { normal: [0, 0, 10, 10], hover: [0, 10, 10, 10], glowing: [0, 20, 10, 10] },
      cuts: [2, 2, 2, 2],
      edges: 'tile',
    });
    expect(Object.keys(frame.states)).toEqual(['normal', 'hover']);
    expect(frame.edges).toBe('tile');
  });

  it("uses a template frame's whole picture when it names no place", () => {
    const frame = templateFrame({ picture: { src: 'a.webp' }, cuts: [1, 1, 1, 1] }, { width: 40, height: 30 });
    expect(frame.states.normal).toEqual([0, 0, 40, 30]);
    const inSheet = templateFrame(
      { picture: { src: 'a.webp', rect: [5, 5, 20, 20] }, cuts: [1, 1, 1, 1] },
      { width: 40, height: 30 },
    );
    expect(inSheet.states.normal).toEqual([5, 5, 20, 20]);
  });
});
