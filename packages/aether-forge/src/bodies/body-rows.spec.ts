import { describe, expect, it } from 'vitest';
import { type BodyRowKeys, bodySubtreeRows } from './body-rows';
import { korhal } from './body-fixtures';

const keys: BodyRowKeys = {
  part: (part) => `p/${part}`,
  material: (name, overlay) => (overlay ? `om/${overlay}/${name}` : `m/${name}`),
  light: (id) => `l/${id}`,
  overlay: (id) => `overlay/${id}`,
  variant: (id) => `variant/${id}`,
  shapes: () => 'shapes',
  lights: () => 'lights',
  overlays: () => 'overlays',
  variants: () => 'variants',
  moons: () => 'moons',
};

describe("a body's subtree", () => {
  it('shows its shapes and the overlays it wears; inside an overlay, that overlay’s shapes alone', () => {
    const all = bodySubtreeRows(korhal({}), 0, new Set(), keys, { movableOverlays: true });
    expect(all.map((r) => r.key)).toEqual([
      'shapes',
      'p/own:sphere-1',
      'm/clouds',
      'p/style:@overlay-1:sphere-1',
      'om/@overlay-1/clouds',
      // (Its lights folded.)
      'lights',
      'overlays',
      'overlay/@overlay-1',
    ]);
    const inside = bodySubtreeRows(korhal({}), 0, new Set(), keys, {
      movableOverlays: true,
      adds: { lights: true, moons: true },
      only: '@overlay-1',
    });
    // (Nothing to add to shown inside it: what it wears, its variants and moons are the body's.)
    expect(inside.map((r) => r.key)).toEqual([
      'shapes',
      'p/style:@overlay-1:sphere-1',
      'om/@overlay-1/clouds',
    ]);
  });
});
