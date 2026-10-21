import { describe, expect, it } from 'vitest';
import { bodyFragment, meshFragment, withDefines } from './scene-shaders';

describe('the shaders’ switches', () => {
  it('defines its switches after the version', () => {
    const source = withDefines('#version 300 es\nvoid main() {}', { GRID: true, SMEAR: false });
    expect(source.split('\n').slice(0, 3)).toEqual([
      '#version 300 es',
      '#define GRID 1',
      '#define SMEAR 0',
    ]);
  });

  it('defines every switch each shader tests', () => {
    for (const source of [bodyFragment(), meshFragment(true)]) {
      const tested = new Set([...source.matchAll(/#if (\w+)/g)].map((m) => m[1]));
      for (const name of tested) expect(source).toContain(`#define ${name} `);
    }
  });
});
