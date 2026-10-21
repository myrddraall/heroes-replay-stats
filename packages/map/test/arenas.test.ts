import { describe, expect, it } from 'vitest';
import { arenasOf, MINIMAP_MARGIN } from '../src/lib/view/arenas';
import { fixturePack } from './fixtures';

describe('arenasOf', () => {
  it('makes the whole map one arena, bounded by the camera bounds, when the pack has none', () => {
    const pack = fixturePack('battlefield-of-eternity');
    const [arena, ...rest] = arenasOf(pack);
    expect(rest).toEqual([]);
    expect(arena?.layer.id).toBe('map');
    expect(arena?.bounds).toEqual(pack.map.cameraBounds);
    expect(arena?.skyAnchor).toBeNull();
    expect(arena?.minimapClip).toBeNull();
    // the map layer's extent, from its origin cell, size and scale
    const layer = arena!.layer;
    expect(arena?.east).toBeCloseTo(layer.originCell[0] + layer.size[0] / layer.pxPerCell);
    expect(arena?.south).toBeCloseTo(layer.originCell[1] - layer.size[1] / layer.pxPerCell);
    expect(arena?.middle[0]).toBeCloseTo((arena!.west + arena!.east) / 2);
  });

  it('gives each of several arenas its own layer, bounds, and the sky anchored to its middle', () => {
    const pack = fixturePack('punisher-arena');
    const arenas = arenasOf(pack);
    expect(arenas.map((a) => [a.label, a.layer.id])).toEqual([
      ['M1', 'map-m1'],
      ['M2', 'map-m2'],
      ['M3', 'map-m3'],
    ]);
    expect(arenas[1]?.bounds).toEqual(pack.arenas?.[1]?.boundsCells);
    expect(arenas[1]?.skyAnchor).toEqual(pack.arenas?.[1]?.middleCell);
  });

  it("clips each arena's part of the minimap halfway to its neighbours, a margin out elsewhere", () => {
    const [m1, m2, m3] = arenasOf(fixturePack('punisher-arena'));
    // M2 lies between M1 (above) and M3 (below)
    expect(m2?.minimapClip?.top).toBeCloseTo((m1!.bounds.bottom + m2!.bounds.top) / 2);
    expect(m2?.minimapClip?.bottom).toBeCloseTo((m3!.bounds.top + m2!.bounds.bottom) / 2);
    expect(m2?.minimapClip?.left).toBeCloseTo(m2!.bounds.left - MINIMAP_MARGIN);
    // M1 has nothing above it
    expect(m1?.minimapClip?.top).toBeCloseTo(m1!.bounds.top + MINIMAP_MARGIN);
  });
});
