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
    // the capture's mercenaries: two lane units born at the camp as it was captured, one still
    // alive at the end; a missile is not one
    unit({
      type: 'MercSiegeTrooperLaner',
      unitClass: 'mercenary',
      ownerTeam: 1,
      bornAt: { x: 101, y: 70 },
      bornAtLoop: at(130),
      diedAtLoop: at(200),
    }),
    unit({
      type: 'MercSiegeTrooperLaner',
      unitClass: 'mercenary',
      ownerTeam: 1,
      bornAt: { x: 99, y: 71 },
      bornAtLoop: at(130),
    }),
    unit({
      type: 'MercSiegeTrooperLanerMissile',
      unitClass: 'mercenary',
      ownerTeam: 1,
      bornAt: { x: 100, y: 70 },
      bornAtLoop: at(130),
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

  it("places a camp by the map's thirds and the half of the team whose towns are nearer", () => {
    const placed = [
      stat('GameStart', -38, { MapSizeX: 248, MapSizeY: 216 }),
      stat('JungleCampInit', -38, { CampID: 1, PositionX: 60, PositionY: 180 }),
      stat('JungleCampInit', -38, { CampID: 2, PositionX: 124, PositionY: 20 }),
      stat('TownStructureInit', -38, {
        TownID: 1,
        Team: 1,
        Lane: 1,
        PositionX: 40,
        PositionY: 110,
      }),
      stat('TownStructureInit', -38, {
        TownID: 2,
        Team: 2,
        Lane: 1,
        PositionX: 208,
        PositionY: 110,
      }),
    ];
    const [left, middle] = mapState(placed, [], 610, 1000, null).camps;
    expect([left?.place, left?.side]).toEqual(['top', 0]);
    expect([middle?.place, middle?.side]).toEqual(['bottom', null]);
  });

  it("gives each camp its stretches up and captured, from its defenders' births and its captures", () => {
    expect(mapState(stats, units, 610, 1000, null).camps).toEqual([
      {
        id: 1,
        type: 'Siege Camp',
        // its defenders as born (the cowering dummy no defender); the replay has no map size, nor
        // towns on both sides
        defenders: ['MercSiegeTrooperDefender'],
        place: 'middle',
        side: null,
        spans: [
          { start: 57, end: 130, team: null, mercs: [] },
          {
            start: 130,
            end: 310,
            team: 1,
            mercs: [
              { start: 130, end: 200 },
              { start: 130, end: 1000 },
            ],
          },
          { start: 310, end: 1000, team: null, mercs: [] },
        ],
      },
    ]);
  });

  it("takes a camp's defenders from the map's game data where it has it, whatever their names", () => {
    const turrets = [
      stat('JungleCampInit', -38, { CampID: 1, PositionX: 100, PositionY: 70 }),
    ];
    const camp = [
      unit({ type: 'OverwatchTurret', unitClass: 'other', bornAt: { x: 101, y: 70 }, bornAtLoop: at(30) }),
      unit({ type: 'OverwatchMechanic', unitClass: 'other', bornAt: { x: 99, y: 70 }, bornAtLoop: at(30) }),
      // the camp's capture beacon, and what a capture leaves: no defenders
      unit({ type: 'TownMercCampCaptureBeacon', bornAt: { x: 100, y: 70 }, bornAtLoop: at(-38) }),
      unit({ type: 'TurretPickup', unitClass: 'other', bornAt: { x: 100, y: 71 }, bornAtLoop: at(200) }),
    ];
    const [state] = mapState(
      turrets,
      camp,
      610,
      1000,
      new Set(['OverwatchTurret', 'OverwatchMechanic']),
    ).camps;
    expect(state?.defenders).toEqual(['OverwatchMechanic', 'OverwatchTurret']);
    expect(state?.spans).toEqual([{ start: 30, end: 1000, team: null, mercs: [] }]);
  });

  it('gives each town its lane, hall and fall, and the structures that fell around it', () => {
    const { towns, cores } = mapState(stats, units, 610, 1000, null);
    expect(towns).toEqual([
      {
        id: 1,
        team: 0,
        lane: 1,
        place: 'top',
        hall: 'fort',
        fell: 600,
        holds: [{ start: 0, end: 600, team: 0 }],
        losses: [{ seconds: 400, kind: 'tower', team: 0 }],
      },
      {
        id: 2,
        team: 0,
        lane: 2,
        place: 'bottom',
        hall: 'keep',
        fell: null,
        holds: [{ start: 0, end: 1000, team: 0 }],
        losses: [],
      },
    ]);
    expect(cores).toEqual([{ team: 0, type: 'KingsCore', fell: 900 }]);
  });

  it('gives a town taken on Towers of Doom each team that held it, and no fall', () => {
    const doom = [
      stat('TownStructureInit', -38, {
        TownID: 1,
        Team: 1,
        Lane: 1,
        PositionX: 80,
        PositionY: 130,
      }),
      stat('TownStructureInit', -38, {
        TownID: 4,
        Team: 2,
        Lane: 1,
        PositionX: 160,
        PositionY: 130,
      }),
      stat('TownStructureDeath', 850, { UnitType: 'TownTownHallL3', TownID: 1 }),
      stat('Town Captured', 850, { 'New Owner': 12 }),
      stat('TownStructureDeath', 930, { UnitType: 'TownTownHallL3', TownID: 1 }),
      stat('Town Captured', 930, { 'New Owner': 11 }),
    ];
    const halls = [
      // the first hall, then each rebuilt for whoever took the town
      unit({
        type: 'TownTownHallL3',
        bornType: 'TownTownHallL2',
        ownerTeam: 0,
        bornAt: { x: 80, y: 130 },
        diedAtLoop: at(850),
      }),
      unit({
        type: 'TownTownHallL3',
        ownerTeam: 1,
        bornAt: { x: 80, y: 130 },
        bornAtLoop: at(850),
        diedAtLoop: at(930),
      }),
      unit({
        type: 'TownTownHallL3',
        ownerTeam: 0,
        bornAt: { x: 80, y: 130 },
        bornAtLoop: at(930),
      }),
      // a well rebuilt for the other team, lost in the town they took
      unit({
        type: 'TownMoonwellL3',
        ownerTeam: 1,
        bornAt: { x: 82, y: 128 },
        bornAtLoop: at(851),
        diedAtLoop: at(925),
      }),
      unit({ type: 'TownTownHallL2', ownerTeam: 1, bornAt: { x: 160, y: 130 } }),
    ];
    const [town, other] = mapState(doom, halls, 610, 1000, null).towns;
    expect(town).toMatchObject({
      id: 1,
      hall: 'fort',
      fell: null,
      holds: [
        { start: 0, end: 850, team: 0 },
        { start: 850, end: 930, team: 1 },
        { start: 930, end: 1000, team: 0 },
      ],
      losses: [{ seconds: 925, kind: 'well', team: 1 }],
    });
    expect(other).toMatchObject({
      id: 4,
      fell: null,
      holds: [{ start: 0, end: 1000, team: 1 }],
      losses: [],
    });
  });
});
