import { describe, expect, it } from 'vitest';
import { withMaterialSwitched } from './body-materials';

describe('switching a material on or off', () => {
  it('sets it only where it differs from the levels under it', () => {
    const off = withMaterialSwitched({}, 'haze', false, true)!;
    expect(off).toEqual({ materials: { haze: { enabled: false } } });
    expect(withMaterialSwitched(off, 'haze', true, true)).toBeUndefined();
    expect(withMaterialSwitched({}, 'haze', true, false)).toEqual({
      materials: { haze: { enabled: true } },
    });
  });
});
