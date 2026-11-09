import type { StatEventRecord, UnitRecord } from '@myrddraall/heroprotocol-db';
import { describe, expect, it } from 'vitest';
import { mapState } from './map-state';

const at = (seconds: number) => 610 + 16 * seconds;
const stat = (eventName: string, seconds: number, values: Record<string, number | string>) =>
  ({
    replayId: 'r',
    seq: 0,
    gameloop: at(seconds),
    seconds,
    eventName,
    playerSlot: null,
    team: null,
    values,
  }) satisfies StatEventRecord;
const unit = (u: Partial<UnitRecord> & Pick<UnitRecord, 'type' | 'bornAt'>): UnitRecord => ({
  replayId: 'r',
  tag: 0,
  tagIndex: 0,
  tagRecycle: 0,
  bornType: null,
  unitClass: 'structure',
  ownerSlot: null,
  ownerTeam: null,
  bornAtLoop: at(0),
  diedAtLoop: null,
  diedAt: null,
  killerSlot: null,
  killerTeam: null,
  killerUnitTag: null,
  revived: 0,
  typeChanges: [],
  ownerChanges: [],
  ...u,
});

describe('map state', () => {
  const stats = [
    stat('JungleCampInit', -38, { CampID: 1, PositionX: 100, PositionY: 70 }),
    stat('JungleCampCapture', 130, { CampID: 1, TeamID: 2, CampType: 'Siege Camp' }),
    stat('TownStructureInit', -38, { TownID: 1, Team: 1, Lane: 1, PositionX: 50, PositionY: 110 }),
    stat('TownStructureInit', -38, { TownID: 2, Team: 1, Lane: 2, PositionX: 50, PositionY: 40 }),
  ];
  const units = [
    // the camp's defenders, at the start and back after the capture; the cowering dummy is not one
    unit({
      type: 'MercSiegeTrooperDefender',
      unitClass: 'mercenary',
      bornAt: { x: 101, y: 71 },
      bornAtLoop: at(57),
    }),
    unit({
      type: 'MercSiegeTrooperDefender',
      unitClass: 'mercenary',
      bornAt: { x: 99, y: 70 },
      bornAtLoop: at(58),
    }),
    unit({
      type: 'MercCoweringDefenderOrientDummy',
      unitClass: 'mercenary',
      bornAt: { x: 100, y: 70 },
      bornAtLoop: at(132),
    }),
    unit({
      type: 'MercSiegeTrooperDefender',
      unitClass: 'mercenary',
      bornAt: { x: 100, y: 69 },
      bornAtLoop: at(310),
    }),
    // the top town's fort and a tower that fell, the bottom town's keep standing
    unit({
      type: 'TownHallDestroyed',
      bornType: 'TownTownHallL2',
      ownerTeam: 0,
      bornAt: { x: 51, y: 111 },
      diedAtLoop: at(600),
    }),
    unit({
      type: 'TownCannonTowerDead',
      bornType: 'TownCannonTowerL2',
      ownerTeam: 0,
      bornAt: { x: 55, y: 105 },
      typeChanges: [{ gameloop: at(400), type: 'TownCannonTowerDead' }],
    }),
    unit({ type: 'TownTownHallL3', ownerTeam: 0, bornAt: { x: 50, y: 41 } }),
    unit({
      type: 'KingsCore',
      unitClass: 'core',
      ownerTeam: 0,
      bornAt: { x: 20, y: 80 },
      diedAtLoop: at(900),
    }),
  ];

  it("gives each camp its stretches up and captured, from its defenders' births and its captures", () => {
    expect(mapState(stats, units, 610, 1000).camps).toEqual([
      {
        id: 1,
        type: 'Siege Camp',
        spans: [
          { start: 57, end: 130, team: null },
          { start: 130, end: 310, team: 1 },
          { start: 310, end: 1000, team: null },
        ],
      },
    ]);
  });

  it('gives each town its lane, hall and fall, and the structures that fell around it', () => {
    const { towns, cores } = mapState(stats, units, 610, 1000);
    expect(towns).toEqual([
      {
        id: 1,
        team: 0,
        lane: 1,
        place: 'top',
        hall: 'fort',
        fell: 600,
        losses: [{ seconds: 400, kind: 'tower' }],
      },
      { id: 2, team: 0, lane: 2, place: 'bottom', hall: 'keep', fell: null, losses: [] },
    ]);
    expect(cores).toEqual([{ team: 0, fell: 900 }]);
  });
});
