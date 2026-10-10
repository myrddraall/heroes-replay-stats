import { describe, expect, it } from 'vitest';
import { readableMaps, type MapCatalog, type MapCatalogEntry } from '../src/lib/pack/map-catalog';
import { MAP_PACK_FORMAT } from '../src/lib/pack/map-pack';

const entry = (id: string, packFormat?: number): MapCatalogEntry => ({
  id,
  name: id,
  category: null,
  gameBuild: null,
  tool: 'heroes-capture 0.0.0-dev',
  structures: null,
  path: `${id}/`,
  pack: `${id}/pack.json`,
  thumbnail: null,
  ...(packFormat === undefined ? {} : { packFormat }),
});

describe('the catalog', () => {
  it("lists the packs of the viewer's format, and those whose format the catalog doesn't give", () => {
    const catalog: MapCatalog = {
      format: 1,
      maps: [entry('old', MAP_PACK_FORMAT - 1), entry('new', MAP_PACK_FORMAT), entry('unsaid')],
    };
    expect(readableMaps(catalog).map((m) => m.id)).toEqual(['new', 'unsaid']);
  });
});
