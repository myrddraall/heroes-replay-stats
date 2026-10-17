import { describe, expect, it } from 'vitest';
import { layerOffset, type SceneLayer, threeKeys } from './play-scene';

const layer: SceneLayer = {
  texture: 'energy',
  channel: 'rgb',
  brightMult: 0.3,
  midtone: 0,
  offset: [0.1, 0],
  angle: 0,
  tiling: [3, 1],
  scroll: { seconds: 200, by: [0.33333, 4] },
};

describe('layerOffset', () => {
  it('scrolls steadily through the loop and starts again', () => {
    expect(layerOffset(layer, 0)).toEqual([0.1, 0]);
    const [u, v] = layerOffset(layer, 50);
    expect(u).toBeCloseTo(0.1 + 0.33333 / 4);
    expect(v).toBeCloseTo(1);
    expect(layerOffset(layer, 250)).toEqual(layerOffset(layer, 50));
  });

  it('keeps a layer without a scroll where it is', () => {
    expect(layerOffset({ ...layer, scroll: undefined }, 123)).toEqual([0.1, 0]);
  });
});

describe('threeKeys', () => {
  // The twinkling stars' alpha: from 0 to its middle at 40% of the life, held for 10%, back to 0.
  const alpha = (t: number) => threeKeys(0, 64, 0, 0.4, 0.1, t);

  it('rises to the middle, holds it, and falls to the end', () => {
    expect(alpha(0)).toBe(0);
    expect(alpha(0.2)).toBeCloseTo(32);
    expect(alpha(0.45)).toBe(64);
    expect(alpha(0.75)).toBeCloseTo(32);
    expect(alpha(1)).toBe(0);
  });

  it('copes with a middle at the very start or end', () => {
    expect(threeKeys(1, 2, 3, 0, 0, 0)).toBe(2);
    expect(threeKeys(1, 2, 3, 1, 0, 1)).toBe(2);
  });
});
