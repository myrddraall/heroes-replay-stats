import { describe, expect, it } from 'vitest';
import type { LightOutline } from '../../aids/beams';
import { outlineAt, rimLeanFacing } from './editing-aids';

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

  it('from a point or a spot: its wrap taken in (its half worked out in the shader)', () => {
    expect(outlineAt(outline({ kind: 1, wrap: 0.3 })).main).toBe(-0.3);
    expect(outlineAt(outline({ kind: 2 })).main).toBe(-0);
  });

  it('a hemisphere, the sky round the body and the rim never stop: only where they are half as strong', () => {
    expect(outlineAt(outline({ kind: 3 }))).toEqual({ main: 9, faint: 0 });
    expect(outlineAt(outline({ kind: 4 }))).toEqual({ main: 9, faint: 0.5 });
    expect(outlineAt(outline({ kind: 4, softness: 2 })).faint).toBeCloseTo(1 - Math.SQRT1_2);
    expect(outlineAt(outline({ kind: 5, fade: 0 })).faint).toBeCloseTo(1 - Math.cbrt(0.5));
    expect(outlineAt(outline({ kind: 5, fade: 0.6 })).faint).toBe(9);
  });
});

describe("a rim's lean as the eye sees it", () => {
  const same = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  it('is its own where its body faces the eye', () => {
    expect(rimLeanFacing(same, same, [0, 1, 0])).toEqual([-0, -1, -0]);
  });
  it('turns with its body where its body is turned from the eye (fixed in the world)', () => {
    // The body turned a quarter about up: its across is the eye's away.
    const turned = new Float32Array([0, 1, 0, -1, 0, 0, 0, 0, 1]);
    const lean = rimLeanFacing(turned, same, [-1, 0, 0]);
    lean.forEach((v, k) => expect(v).toBeCloseTo([0, 1, 0][k]!));
  });
});
