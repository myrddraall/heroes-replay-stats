import { describe, expect, it } from 'vitest';
import { compileBlock, UniformSet } from './scene-uniforms';

describe('uniforms worked out once', () => {
  it('keeps each name’s last value, and leaves out what a program doesn’t use', () => {
    const u = new UniformSet().f1('uStrength', 1).f1('uStrength', 2).i1('uUnused', 3);
    const at = { uStrength: {} as WebGLUniformLocation };
    const block = compileBlock(u, (name) => at[name as keyof typeof at] ?? null);
    expect(block).toHaveLength(1);
    expect(block[0]!.at).toBe(at.uStrength);
    expect([...block[0]!.value]).toEqual([2]);
  });
});
