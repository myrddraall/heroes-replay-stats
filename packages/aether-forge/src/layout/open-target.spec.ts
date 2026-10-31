import { describe, expect, it } from 'vitest';
import {
  isAsset,
  libraryKindOf,
  libraryPath,
  libraryShown,
  openKey,
  openOf,
  openPath,
  parseOpen,
  RANDOM_SETS,
} from './open-target';

describe('open-target', () => {
  it('reads what the URL opens, and writes it back the same', () => {
    expect(parseOpen('material:edgeLight222-korhal')).toEqual({
      kind: 'material',
      id: 'edgeLight222-korhal',
    });
    expect(openKey(parseOpen('scene:scene-1'))).toBe('scene:scene-1');
    expect(isAsset(parseOpen('planet:korhal'))).toBe(true);
  });

  it('opens the random sets for nothing, or what it cannot read', () => {
    expect(parseOpen(undefined)).toBe(RANDOM_SETS);
    expect(parseOpen('korhal')).toBe(RANDOM_SETS);
    expect(parseOpen('moon:x')).toBe(RANDOM_SETS);
    expect(isAsset(RANDOM_SETS)).toBe(false);
  });

  it('opens the random sets in the editor by a name of their own', () => {
    expect(openPath(RANDOM_SETS)).toEqual(['scene', 'random-sets']);
    expect(openOf('scene', 'random-sets')).toBe(RANDOM_SETS);
    expect(openOf(undefined, undefined)).toBe(RANDOM_SETS);
  });

  it('lists a kind in the library, by its plural, one of them shown behind', () => {
    expect(libraryPath('planet', 'korhal')).toEqual(['library', 'planets', 'korhal']);
    expect(libraryPath('style')).toEqual(['library', 'overlays']);
    expect(libraryKindOf('overlays')).toBe('style');
    expect(libraryKindOf('moons')).toBeUndefined();
    expect(libraryShown('planet', 'korhal')).toEqual({ kind: 'planet', id: 'korhal' });
    // Nothing of the kind named: the random sets behind the list.
    expect(libraryShown('scene', undefined)).toBe(RANDOM_SETS);
  });

  it('calls styles overlays in the URL, and still reads them as styles', () => {
    expect(openPath({ kind: 'style', id: 'nexus' })).toEqual(['overlay', 'nexus']);
    expect(openOf('overlay', 'nexus')).toEqual({ kind: 'style', id: 'nexus' });
    expect(openOf('style', 'nexus')).toEqual({ kind: 'style', id: 'nexus' });
  });

  it('opens a material under the planet or overlay it was opened from', () => {
    const fromKorhal = {
      kind: 'material',
      id: 'skyLights',
      on: { kind: 'planet', id: 'korhal' },
    } as const;
    expect(openPath(fromKorhal)).toEqual(['planet', 'korhal', 'material', 'skyLights']);
    expect(openOf('material', 'skyLights', 'planet', 'korhal')).toEqual(fromKorhal);
    expect(openOf('material', 'grid', 'overlay', 'nexus')).toEqual({
      kind: 'material',
      id: 'grid',
      on: { kind: 'style', id: 'nexus' },
    });
    // Only a material, and only under a planet or an overlay.
    expect(openOf('planet', 'korhal', 'planet', 'x')).toEqual({ kind: 'planet', id: 'korhal' });
    expect(openOf('material', 'grid', 'scene', 'x')).toEqual({ kind: 'material', id: 'grid' });
  });
});
