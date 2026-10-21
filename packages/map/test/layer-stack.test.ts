import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORDER,
  DEFAULT_RATE,
  ORDER_STEP,
  packStack,
  resolvePlacement,
} from '../src/lib/view/layer-stack';
import { fixturePack } from './fixtures';

describe('packStack', () => {
  it("stacks a pack's layers in its order, every map layer as the terrain, the minimap in front", () => {
    const pack = fixturePack('punisher-arena');
    const haze = pack.layers.find((l) => l.id === 'haze');
    expect(packStack(pack)).toEqual([
      { id: 'fixed', kind: 'fixed', order: 0, rate: 0 },
      { id: 'background', kind: 'tiles', order: ORDER_STEP, rate: expect.any(Number) },
      {
        id: 'haze',
        kind: 'tiles',
        order: 2 * ORDER_STEP,
        rate: haze?.kind === 'parallax' && haze.rate,
      },
      { id: 'map', kind: 'tiles', order: 3 * ORDER_STEP, rate: 1 },
      { id: 'minimap', kind: 'minimap', order: 3 * ORDER_STEP + 2, rate: 1 },
    ]);
  });

  it('puts the elements just in front of the terrain, under the minimap', () => {
    const stack = packStack(fixturePack('battlefield-of-eternity'));
    const order = (id: string) => stack.find((s) => s.id === id)?.order ?? NaN;
    expect(order('elements')).toBe(order('map') + 1);
    expect(order('minimap')).toBe(order('map') + 2);
    expect(stack.find((s) => s.id === 'elements')).toMatchObject({ kind: 'elements', rate: 1 });
  });
});

describe('resolvePlacement', () => {
  const stack = packStack(fixturePack('battlefield-of-eternity'));
  const haze = stack.find((s) => s.id === 'haze')!;
  const map = stack.find((s) => s.id === 'map')!;

  it('takes numbers as they are, numeric attributes too', () => {
    expect(resolvePlacement(12, 0.3, stack)).toEqual({ order: 12, rate: 0.3 });
    expect(resolvePlacement('35', '0.5', stack)).toEqual({ order: 35, rate: 0.5 });
  });

  it('puts a layer named by order just in front of it, and moves one named by rate with it', () => {
    expect(resolvePlacement('map', 'haze', stack)).toEqual({
      order: map.order + 0.5,
      rate: haze.rate,
    });
  });

  it('falls back to in front of everything, moving with the map', () => {
    expect(resolvePlacement(undefined, undefined, stack)).toEqual({
      order: DEFAULT_ORDER,
      rate: DEFAULT_RATE,
    });
    expect(resolvePlacement('nowhere', 'nothing', stack)).toEqual({
      order: DEFAULT_ORDER,
      rate: DEFAULT_RATE,
    });
    expect(resolvePlacement('', ' ', [])).toEqual({ order: DEFAULT_ORDER, rate: DEFAULT_RATE });
  });
});
