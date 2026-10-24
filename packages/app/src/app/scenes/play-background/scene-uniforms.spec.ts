import { describe, expect, it } from 'vitest';
import { UniformSet } from './scene-uniforms';

describe('uniforms worked out once', () => {
  it('keeps each name’s last value', () => {
    const u = new UniformSet().f1('uStrength', 1).f1('uStrength', 2).i1('uCount', 3);
    expect([...u.values.keys()]).toEqual(['uStrength', 'uCount']);
    expect([...u.values.get('uStrength')!.value]).toEqual([2]);
  });
});
