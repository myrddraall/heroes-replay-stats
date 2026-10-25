import { describe, expect, it } from 'vitest';
import { keyLightFrom, lightFrom, rimTurn, TOWARDS_EYE } from './directions';
import type { PlanetLight } from '../formats/planets';

const rig: PlanetLight = {
  ambient: [0, 0, 0],
  exposure: 1,
  directional: [
    { direction: [0, 0, -1], color: [0.2, 0.2, 0.2] }, // a dim light from above
    { direction: [-1, 0, 0], color: [2, 2, 2] }, // the key: from the right (travelling left)
    { direction: [0, 1, 0], color: [0, 0, 0] }, // none
  ],
};

describe('directions about a planet', () => {
  it('find where the key light comes from', () => {
    expect(keyLightFrom(rig)).toEqual([1, -0, -0]);
    expect(keyLightFrom(undefined)).toBeNull();
  });

  it('turn the whole rig so the key comes from where it is asked to', () => {
    const turned = lightFrom(rig, [-1, 0, 0]); // from the left now
    const [x, y, z] = keyLightFrom(turned)!;
    expect([x, y, z].map((v) => +v.toFixed(6))).toEqual([-1, 0, 0]);
    // The dim light from above turned with it: still from above.
    const dim = turned.directional[0]!.direction;
    expect(dim[2]).toBeCloseTo(-1);
  });

  it('turn about either way round, half a turn too', () => {
    const turned = lightFrom(rig, [0, 0, 1]);
    expect(keyLightFrom(turned)![2]).toBeCloseTo(1);
    const back = lightFrom(rig, [-1, 0, 0]);
    expect(Math.hypot(...back.directional[0]!.direction)).toBeCloseTo(1);
  });

  it('lean the rims nowhere for the middle of the face, to the right and up as asked', () => {
    expect(rimTurn(TOWARDS_EYE).map((v) => +v.toFixed(6) + 0)).toEqual([0, 0]);
    const [yaw, pitch] = rimTurn([0.5, -0.5, 0.5]);
    expect(yaw).toBeGreaterThan(0);
    expect(pitch).toBeLessThan(0);
  });
});
