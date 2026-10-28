import { describe, expect, it } from 'vitest';
import type { LightOutline } from '../../aids/beams';
import { outlineAt } from './editing-aids';

const outline = (o: Partial<LightOutline>): LightOutline => ({
  shape: 'outline',
  centre: [0, 0, 0],
  radius: 1,
  axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  kind: 0,
  direction: [0, 1, 0],
  position: [0, 0, 0],
  aim: [0, 0, 1],
  fade: 1,
  cone: 90,
  edge: 0,
  wrap: 0,
  softness: 1,
  colour: [1, 1, 1],
  darkens: false,
  ...o,
});

describe("a light's outline on its body", () => {
  it('from a side: where it stops reaching (its wrap) and where it reaches half (its softness)', () => {
    expect(outlineAt(outline({}))).toEqual({ main: -0, faint: 0.5 });
    expect(outlineAt(outline({ wrap: 0.5 }))).toEqual({ main: -0.5, faint: 0.25 });
    expect(outlineAt(outline({ softness: 2 })).faint).toBeCloseTo(Math.SQRT1_2);
  });

  it('from a point or a spot: its wrap taken in; above and below: where its colours meet', () => {
    expect(outlineAt(outline({ kind: 1, wrap: 0.3 })).main).toBe(-0.3);
    expect(outlineAt(outline({ kind: 2 })).main).toBe(-0);
    expect(outlineAt(outline({ kind: 3 })).main).toBe(0);
  });

  it('the sky round the body and the rim: where they reach half, none where all of it does', () => {
    expect(outlineAt(outline({ kind: 4 })).main).toBe(0.5);
    expect(outlineAt(outline({ kind: 4, softness: 2 })).main).toBeCloseTo(1 - Math.SQRT1_2);
    expect(outlineAt(outline({ kind: 5, fade: 0 })).main).toBeCloseTo(1 - Math.cbrt(0.5));
    expect(outlineAt(outline({ kind: 5, fade: 0.6 })).main).toBe(9);
  });
});
