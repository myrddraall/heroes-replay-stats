import { describe, expect, it } from 'vitest';
import type { PackMapLayer } from '../pack/map-pack';
import { tilesToEvict, TilePyramid } from './tile-pyramid';
import { fixturePack } from '../pack/pack-fixtures';

const map = fixturePack('battlefield-of-eternity').layers.find(
  (l): l is PackMapLayer => l.kind === 'map',
)!;
const archive = { getZxy: async () => undefined };

describe('TilePyramid', () => {
  it('covers the layer at each level, one tile at level 0', () => {
    const pyramid = new TilePyramid(map, archive);
    expect(pyramid.grid(0)).toEqual([1, 1]);
    const top = map.levels - 1;
    expect(pyramid.span(top)).toBe(map.tileSize);
    expect(pyramid.grid(top)).toEqual([
      Math.ceil(map.size[0] / map.tileSize),
      Math.ceil(map.size[1] / map.tileSize),
    ]);
  });

  it("draws nothing coarser than the overview's level, and reads only the finer levels from the archive", () => {
    const pyramid = new TilePyramid(map, archive);
    expect(pyramid.floor).toBe(map.overview.level);
    expect(pyramid.stored(map.overview.level)).toBe(false);
    expect(pyramid.stored(map.overview.level + 1)).toBe(true);
    expect(pyramid.stored(0)).toBe(false);
    const single = new TilePyramid(
      { ...map, levels: 1, overview: { ...map.overview, level: 0 } },
      archive,
    );
    expect(single.stored(0)).toBe(true); // a layer of one level: the archive holds it
  });

  it('keeps one tile per address, marked with the last frame that needed it', () => {
    const pyramid = new TilePyramid(map, archive);
    const tile = pyramid.tileAt(2, 1, 1, 5);
    expect(pyramid.tileAt(2, 1, 1, 9)).toBe(tile);
    expect(tile.used).toBe(9);
  });
});

describe('tilesToEvict', () => {
  it('drops the least recently needed loaded tiles, never one of this frame', () => {
    const pyramid = new TilePyramid(map, archive);
    for (let x = 0; x < 5; x++) pyramid.tileAt(3, x, 0, x).state = 'loaded';
    pyramid.tileAt(3, 9, 9, 0); // not loaded: never counted
    expect(tilesToEvict([pyramid], 5, 4)).toEqual([]);
    expect(tilesToEvict([pyramid], 3, 4).map(([, key]) => key)).toEqual(['3/0/0', '3/1/0']);
    // with every loaded tile needed in this frame, nothing goes
    for (let x = 0; x < 5; x++) pyramid.tileAt(3, x, 0, 7);
    expect(tilesToEvict([pyramid], 3, 7)).toEqual([]);
  });
});
