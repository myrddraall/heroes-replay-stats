import { describe, expect, it } from 'vitest';
import { bakeRect, bakeSize, scrollPixels } from './body-bakes';
import { projectionMatrix, viewMatrix } from './scene-space';

const view = viewMatrix([0, 0, 0], [0, 1, 0], [0, 0, 1]);
const vp = (() => {
  const p = projectionMatrix(45, 2, 0.1, Infinity);
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r]! += p[k * 4 + r]! * view[c * 4 + k]!;
  return out;
})();

describe('a body baked on its own', () => {
  it('covers the pixels its square does, a little past, within the frame', () => {
    const rect = bakeRect(
      [
        [-1, 10, -1],
        [1, 10, -1],
        [-1, 10, 1],
        [1, 10, 1],
      ],
      vp,
      800,
      400,
    )!;
    // Centred, as wide as it is high.
    expect(rect.x + rect.w / 2).toBeCloseTo(400, 0);
    expect(rect.y + rect.h / 2).toBeCloseTo(200, 0);
    expect(rect.w).toBe(rect.h);
    expect(bakeRect([[0, -10, 0]], vp, 800, 400)).toEqual({ x: 0, y: 0, w: 800, h: 400 });
    expect(
      bakeRect(
        [
          [100, 10, 0],
          [101, 10, 0],
        ],
        vp,
        800,
        400,
      ),
    ).toBeNull();
  });

  it('keeps its target while it grows a little', () => {
    expect(bakeSize(10)).toBe(64);
    expect(bakeSize(65)).toBe(128);
  });

  it('knows how fast its scrolling layers cross it, in pixels', () => {
    const rect = { x: 0, y: 0, w: 100, h: 50 };
    expect(scrollPixels([], rect)).toBe(0);
    // A tenth of the way round in 10 s, over a body 100 pixels wide: 2 pixels a second.
    expect(scrollPixels([{ scroll: { by: [0.1, 0], seconds: 10 } }], rect)).toBeCloseTo(2);
  });
});
