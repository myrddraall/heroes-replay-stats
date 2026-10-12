import { describe, expect, it } from 'vitest';
import { allPois, campLabel, poisOf, structureLabel } from '../src/lib/pack/pois';
import { fixturePack } from './fixtures';

describe('the points of interest of a pack', () => {
  const pack = fixturePack('battlefield-of-eternity');
  const teams = poisOf(pack);
  const group = (id: string) => teams.flatMap((t) => t.groups).find((g) => g.id === id)!;

  it('lists every structure and camp once', () => {
    const keys = allPois(teams).map((p) => p.key);
    const elements = pack.data.elements!;
    expect(keys.length).toBe(elements.structures.length + elements.camps.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('goes team by team: Order, Chaos, then neither side', () => {
    expect(teams.map((t) => [t.id, t.label, t.owner])).toEqual([
      ['order', 'Order', 'order'],
      ['chaos', 'Chaos', 'chaos'],
      ['neutral', 'Neutral', null],
    ]);
  });

  it("groups a team's: core, towns by number each with its outposts, loose ones; the camps last", () => {
    expect(teams[0].groups.map((g) => g.id)).toEqual([
      'core-order',
      'town-1',
      'outpost-1',
      'town-2',
      'town-3',
      'town-4',
      'other-order',
    ]);
    expect(teams[1].groups.map((g) => g.id)).toEqual([
      'core-chaos',
      'town-5',
      'town-6',
      'town-7',
      'outpost-2',
      'town-8',
    ]);
    expect(teams[2].groups.map((g) => g.id)).toEqual(['camps']);
    expect(group('core-order').label).toBe('Core');
    expect(group('town-5').label).toBe('Town 5');
    expect(group('outpost-2').label).toBe('Outpost 2');
    expect(group('other-order').pois.map((p) => p.label)).toEqual(['Tower']);
    expect(group('camps').label).toBe('Mercenary camps');
    expect(group('camps').pois.map((p) => p.label)).toEqual([
      'Siege camp',
      'Bruiser camp',
      'Siege camp',
      'Bruiser camp',
    ]);
  });

  it("keeps a town's hall ring apart from its outpost, the lane's forward pieces", () => {
    const ring = group('town-1').pois;
    expect(ring.every((p) => p.town === 1 && p.outpost === null)).toBe(true);
    expect(ring.map((p) => p.label)[0]).toBe('Keep');
    const outpost = group('outpost-1').pois;
    expect(outpost.every((p) => p.town === 1 && p.outpost === 1)).toBe(true);
    expect(outpost.map((p) => p.label)).toEqual([
      'Tower',
      'Tower',
      'Tower',
      'Gate',
      'Healing fountain',
    ]);
  });

  it("puts a group's hall first, then its towers, gate, fountain and walls", () => {
    const town = group('town-1');
    const labels = town.pois.map((p) => p.label);
    expect(labels[0]).toMatch(/^(Fort|Keep)$/);
    const ranks = labels.map((l) =>
      ['Fort', 'Keep', 'Tower', 'Gate', 'Healing fountain', 'Wall'].indexOf(l),
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(town.owner).toBe('order');
  });

  it('gives nothing for a pack without an elements render', () => {
    expect(poisOf(fixturePack('punisher-arena'))).toEqual([]);
  });

  it('names the types', () => {
    expect(structureLabel('KingsCore')).toBe('Core');
    expect(structureLabel('TownTownHallL2')).toBe('Fort');
    expect(structureLabel('TownTownHallL3')).toBe('Keep');
    expect(structureLabel('TownCannonTowerL3Standalone')).toBe('Tower');
    expect(structureLabel('TownGateL3BLURTLVisionBlocked')).toBe('Gate');
    expect(structureLabel('TownWallRadial17L2')).toBe('Wall');
    expect(structureLabel('TownMoonwellL3')).toBe('Healing fountain');
    expect(structureLabel('SomethingNew')).toBe('SomethingNew');
    expect(campLabel('SiegeCamp1')).toBe('Siege camp');
    expect(campLabel('BruiserCamp1')).toBe('Bruiser camp');
    expect(campLabel('BossCampGolem')).toBe('Boss camp');
  });
});
