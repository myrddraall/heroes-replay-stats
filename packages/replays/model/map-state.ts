import {
  gameSeconds,
  type StatEventRecord,
  type Team,
  type UnitRecord,
} from '@myrddraall/heroprotocol-db';
import { structureKind, type StructureKind } from './structure-kind';

/** A stretch a camp spent one way: up for the taking, or captured by a team until it came back. */
export interface CampSpan {
  readonly start: number;
  readonly end: number;
  /** The team that captured it; null while it was up. */
  readonly team: Team | null;
}

/** A mercenary camp over the game. */
export interface CampState {
  readonly id: number;
  /** The game's name for it (`Siege Camp`); null when it was never captured. */
  readonly type: string | null;
  readonly spans: readonly CampSpan[];
}

/** A structure that fell in a town. */
export interface TownLoss {
  readonly seconds: number;
  readonly kind: StructureKind;
}

/** A town (a fort's or a keep's, with its towers, walls, gates and wells) over the game. */
export interface TownState {
  readonly id: number;
  readonly team: Team;
  /** The game's lane number. */
  readonly lane: number;
  /** Where the lane runs, top to bottom on the map; null on a map with one lane. */
  readonly place: 'top' | 'middle' | 'bottom' | null;
  /** The town's hall: a fort or a keep; null when the replay has no hall for it. */
  readonly hall: 'fort' | 'keep' | null;
  /** When its hall fell; null when it stood to the end. */
  readonly fell: number | null;
  /** Its other structures that fell, in order. */
  readonly losses: readonly TownLoss[];
}

/** A team's core over the game. */
export interface CoreState {
  readonly team: Team;
  /** When it fell; null when it stood to the end. */
  readonly fell: number | null;
}

/** The map's camps, towns and cores over the game; times are seconds on the game's clock. */
export interface MapState {
  readonly camps: readonly CampState[];
  readonly towns: readonly TownState[];
  readonly cores: readonly CoreState[];
}

/** How near (map units) a unit's birth is to a camp or town for it to be that camp's or town's. */
const NEAR = 12;

/** The game's `Team`/`TeamID` (1, 2) as a team (0, 1). */
const teamOf = (v: unknown): Team | null => (v === 1 ? 0 : v === 2 ? 1 : null);
const num = (e: StatEventRecord, key: string): number | null => {
  const v = e.values[key];
  return typeof v === 'number' ? v : null;
};

/**
 * The map over the game, from the replay's stat events and units:
 * - each camp's stretches: up from when its defenders are born (at the start, and each time it
 *   comes back) until a team captures it, then the team's until its next defenders are born;
 * - each town (`TownStructureInit`), with its hall and its other structures (the units born nearest
 *   it, on its team) and when each fell: a tower when it turned into its ruin, the rest when they
 *   died;
 * - each team's core and when it fell.
 */
export function mapState(
  stats: readonly StatEventRecord[],
  units: readonly UnitRecord[],
  startLoop: number,
  durationSeconds: number,
): MapState {
  const seconds = (loop: number) => gameSeconds(loop, startLoop);

  // camps
  const captures = stats.filter((e) => e.eventName === 'JungleCampCapture');
  const camps = stats
    .filter((e) => e.eventName === 'JungleCampInit')
    .map((init): CampState => {
      const id = num(init, 'CampID') ?? -1;
      const x = num(init, 'PositionX') ?? 0;
      const y = num(init, 'PositionY') ?? 0;
      // its defenders' births, a few seconds apart for one spawn
      const spawns = units
        .filter(
          (u) =>
            u.ownerTeam === null &&
            /Defender/.test(u.type) &&
            !/Cowering|Dummy/.test(u.type) &&
            Math.hypot(u.bornAt.x - x, u.bornAt.y - y) < NEAR,
        )
        .map((u) => seconds(u.bornAtLoop))
        .sort((a, b) => a - b)
        .filter((s, i, all) => i === 0 || s - all[i - 1]! > 10);
      const mine = captures.filter((c) => num(c, 'CampID') === id);
      const marks = [
        ...spawns.map((s) => ({ at: s, team: null as Team | null })),
        ...mine.map((c) => ({ at: c.seconds, team: teamOf(c.values['TeamID']) })),
      ].sort((a, b) => a.at - b.at);
      const spans = marks.map((m, i) => ({
        start: m.at,
        end: marks[i + 1]?.at ?? durationSeconds,
        team: m.team,
      }));
      const type = mine.map((c) => c.values['CampType']).find((t) => typeof t === 'string');
      return { id, type: typeof type === 'string' ? type : null, spans };
    })
    .sort((a, b) => a.id - b.id);

  // towns
  const inits = stats.filter((e) => e.eventName === 'TownStructureInit');
  const towns = inits.map((e) => ({
    id: num(e, 'TownID') ?? -1,
    team: teamOf(e.values['Team']),
    lane: num(e, 'Lane') ?? 0,
    x: num(e, 'PositionX') ?? 0,
    y: num(e, 'PositionY') ?? 0,
  }));
  const nearestTown = (u: UnitRecord) =>
    towns
      .filter((t) => t.team === u.ownerTeam)
      .sort(
        (a, b) =>
          Math.hypot(a.x - u.bornAt.x, a.y - u.bornAt.y) -
          Math.hypot(b.x - u.bornAt.x, b.y - u.bornAt.y),
      )[0];
  const structures = units.flatMap((u) => {
    const kind = structureKind(u.bornType ?? u.type) ?? structureKind(u.type);
    if (kind === null || kind === 'core' || u.ownerTeam === null) return [];
    const loop =
      kind === 'tower'
        ? (u.typeChanges.find((c) => c.type === 'TownCannonTowerDead')?.gameloop ?? null)
        : u.diedAtLoop;
    const town = nearestTown(u);
    return town ? [{ town: town.id, kind, fell: loop === null ? null : seconds(loop) }] : [];
  });
  // the lanes' places, by where their towns are: higher on the map is the top
  const lanes = [...new Set(towns.map((t) => t.lane))]
    .map((lane) => {
      const ys = towns.filter((t) => t.lane === lane).map((t) => t.y);
      return { lane, y: ys.reduce((a, b) => a + b, 0) / ys.length };
    })
    .sort((a, b) => b.y - a.y);
  const places: Record<number, TownState['place']> = Object.fromEntries(
    lanes.map(({ lane }, i) => [
      lane,
      lanes.length === 1 ? null : i === 0 ? 'top' : i === lanes.length - 1 ? 'bottom' : 'middle',
    ]),
  );
  const townStates = towns.flatMap((t): TownState[] => {
    if (t.team === null) return [];
    const own = structures.filter((s) => s.town === t.id);
    const hall = own.find((s) => s.kind === 'fort' || s.kind === 'keep');
    return [
      {
        id: t.id,
        team: t.team,
        lane: t.lane,
        place: places[t.lane] ?? null,
        hall: hall ? (hall.kind as 'fort' | 'keep') : null,
        fell: hall?.fell ?? null,
        losses: own
          .filter((s) => s !== hall && s.fell !== null)
          .map((s) => ({ seconds: s.fell!, kind: s.kind }))
          .sort((a, b) => a.seconds - b.seconds),
      },
    ];
  });

  // cores
  const cores = units
    .filter((u) => structureKind(u.type) === 'core' && u.ownerTeam !== null)
    .map((u) => ({
      team: u.ownerTeam!,
      fell: u.diedAtLoop === null ? null : seconds(u.diedAtLoop),
    }))
    .sort((a, b) => a.team - b.team);

  return { camps, towns: townStates, cores };
}
