import { describe, expect, it } from 'vitest';
import { materialAt, materialsOf, offPart, onPart, sharedMaterials } from './materials';
import { file, korhal } from '../bodies/body-fixtures';

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
