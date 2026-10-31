import { describe, expect, it } from 'vitest';
import {
  materialAt,
  materialsOf,
  movedInPart,
  movedShape,
  offPart,
  onPart,
  sharedMaterials,
} from './materials';
import { file, korhal, material } from '../bodies/body-fixtures';
import { partsInDrawOrder } from '../parts/parts';
import { BodyInfo } from '../bodies/body';

describe('editor model', () => {
  it("sets a body's own material and an overlay's of the same name apart", () => {
    const list = materialsOf(
      korhal({
        materials: { clouds: { strength: 2 }, 'style:@overlay-1:clouds': { strength: 4 } },
      }),
    );
    const own = materialAt(list, 'clouds');
    const worn = materialAt(list, 'style:@overlay-1:clouds');
    expect(own?.overlay).toBeUndefined();
    expect(worn?.overlay).toBe('@overlay-1');
    expect(own?.values.strength).toBe(2);
    expect(worn?.values.strength).toBe(4);
    // The material's base settings are both's.
    expect(own?.values.scale).toBe(3);
    expect(worn?.values.scale).toBe(3);
  });

  it('keeps an overlay opened on its own by its key', () => {
    const list = materialsOf({
      ...korhal({ materials: { 'style:@overlay-1:clouds': { strength: 4 } } }),
      id: '@overlay-1',
      overlays: [],
      file: file('style'),
    });
    expect(list.map((m) => m.key)).toEqual(['style:@overlay-1:clouds']);
    expect(list[0]?.values.strength).toBe(4);
  });
});

describe('a material’s rows on parts', () => {
  it('tells apart by part only the materials drawn on more than one part', () => {
    const shared = sharedMaterials([
      { materials: [{ name: 'rock' }, { name: 'glow' }, { name: 'glow' }] },
      { materials: [{ name: 'rock' }] },
      { materials: [{ name: 'sea' }] },
    ]);
    expect([...shared]).toEqual(['rock']);
  });

  it('keeps the material’s name in its key, the part after it', () => {
    const key = onPart('body:0/m/rock', 'own:tube-1');
    expect(key).toBe('body:0/m/rock#own:tube-1');
    expect(offPart(key.slice('body:0/m/'.length))).toBe('rock');
    expect(onPart('body:0/m/rock')).toBe('body:0/m/rock');
    expect(offPart('rock')).toBe('rock');
  });
});

describe('shapes in the order they are drawn', () => {
  it("lists the planet's and its overlays' together, and moves one with its materials", () => {
    const b = korhal({});
    const before = partsInDrawOrder(b, materialsOf(b));
    expect(before.map((n) => n.part.overlay ?? 'own')).toEqual(['own', '@overlay-1']);
    const [own, worn] = before;
    // The overlay's shape put under the planet's own: its material drawn first.
    const order = movedShape(b, materialsOf(b), worn!.part.key, own!.part.key, false);
    expect(order).toEqual(['style:@overlay-1:clouds', 'clouds']);
    const moved = korhal({ order });
    expect(partsInDrawOrder(moved, materialsOf(moved)).map((n) => n.part.overlay ?? 'own')).toEqual(
      ['@overlay-1', 'own'],
    );
    // Onto itself: nothing moved.
    expect(movedShape(b, materialsOf(b), own!.part.key, own!.part.key, true)).toBeUndefined();
  });
});

describe('opaque materials in the draw order', () => {
  // A surface drawing two opaque materials and a blended one over them.
  const surface = (settings: BodyInfo['settings']): BodyInfo => {
    const base = korhal(settings);
    const world = base.file!;
    return {
      ...base,
      overlays: [],
      file: {
        ...world,
        parts: [{ ...world.parts[0]!, materials: ['rock', 'lava', 'clouds'] }],
        materials: {
          rock: { ...material, blend: 'opaque' },
          lava: { ...material, blend: 'opaque' },
          clouds: material,
        },
      },
    };
  };

  it('moves an opaque one among the opaque, never past a blended one', () => {
    const b = surface({});
    expect(materialsOf(b).map((m) => m.key)).toEqual(['rock', 'lava', 'clouds']);
    const order = movedInPart(b, materialsOf(b), 'lava', 'rock', false);
    expect(order).toEqual(['lava', 'rock', 'clouds']);
    expect(materialsOf(surface({ order })).map((m) => m.key)).toEqual(['lava', 'rock', 'clouds']);
    // Over the blended one: not moved (the opaque are drawn first).
    expect(movedInPart(b, materialsOf(b), 'rock', 'clouds', true)).toBeUndefined();
  });
});
