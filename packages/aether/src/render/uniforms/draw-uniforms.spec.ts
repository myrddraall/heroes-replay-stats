import { describe, expect, it } from 'vitest';
import { layerBrightness } from './draw-uniforms';

describe('layerBrightness', () => {
  it('squares the data multiplier', () => {
    expect(layerBrightness(0.3)).toBeCloseTo(0.09);
    expect(layerBrightness(1)).toBe(1);
  });
});
