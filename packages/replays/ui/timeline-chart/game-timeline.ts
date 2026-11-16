import type { Team } from '@myrddraall/heroprotocol-db';
import {
  type MapState,
  type ReplayTimeline,
  type TeamColor,
  type TownState,
  timelineSeconds,
} from '../../model';
import type { DeadSpan, ReplayDeaths } from './death-lanes';
import { campNames, townName } from './map-names';

/** The kinds of event the timeline marks, each shown or hidden on its own. */
export type TimelineEventKind = 'gates' | 'result' | 'talent' | 'level' | 'camp' | 'structure';

/** How the timeline marks a kind of event: its name and its shape. */
export interface TimelineEventLook {
  readonly kind: TimelineEventKind;
  readonly label: string;
  /** The shape's corners in a 10 × 10 box, `x,y` each; null for a circle. */
  readonly points: string | null;
  /**
   * For a kind marked by its own text instead of a shape (each event's `mark`, a team level's
   * number): an example, for the key and the controls; null for a shape.
   */
  readonly text: string | null;
}

/** Each kind of event, in the order the controls list them. */
export const TIMELINE_EVENTS: readonly TimelineEventLook[] = [
  { kind: 'gates', label: 'Gates open', points: '0,10 0,3 5,0 10,3 10,10', text: null },
  { kind: 'result', label: 'Victory and defeat', points: '0,0 10,3 2,6 2,10 0,10', text: null },
  { kind: 'talent', label: 'Talent picks', points: null, text: null },
  { kind: 'level', label: 'Team levels', points: null, text: '10' },
  { kind: 'camp', label: 'Camp captures', points: '5,0 10,10 0,10', text: null },
  { kind: 'structure', label: 'Forts and keeps', points: '0,0 10,0 10,10 0,10', text: null },
];

/** An event's shape as a CSS clip path (for the legend and the controls). */
export function eventClip({ points }: TimelineEventLook): string {
  return points === null
    ? 'circle(50%)'
    : `polygon(${points
        .split(' ')
        .map((p) =>
          p
            .split(',')
            .map((v) => `${Number(v) * 10}%`)
            .join(' '),
        )
        .join(', ')})`;
}

/** A row of the timeline: a team's (its levels, captures and structures) or a player's. */
export type GameTimelineRow =
  | { readonly kind: 'team'; readonly team: Team; readonly color: TeamColor | null }
  | { readonly kind: 'player'; readonly lane: number };

/** How a player was for a stretch: alive or dead, connected or not. */
export interface PlayerState {
  readonly dead: boolean;
  readonly disconnected: boolean;
}

/**
 * A stretch's look, as the timeline draws it (its colours are named by it): a player's state, or
 * `row`, the tables' rows' own (a camp up for the taking, in the neutral theme), or `unready`, darker
 * (a camp before it first comes up).
 */
export type PlayerStateKey = 'row' | 'unready' | 'alive' | 'dead' | 'away' | 'away-dead';

/** A state's name and key. */
export interface PlayerStateLook {
  readonly key: PlayerStateKey;
  readonly label: string;
}

/**
 * A player's stretch's look: their team's row, darker while dead; grey while disconnected, darker
 * while dead too.
 */
export function playerStateLook({ dead, disconnected }: PlayerState): PlayerStateLook {
  if (disconnected)
    return dead
      ? { key: 'away-dead', label: 'Disconnected while dead' }
      : { key: 'away', label: 'Disconnected' };
  return dead ? { key: 'dead', label: 'Dead' } : { key: 'alive', label: 'Alive' };
}

/** The states the key shows (alive is the team's own row). */
export const PLAYER_STATE_KEY: readonly PlayerStateLook[] = [
  playerStateLook({ dead: true, disconnected: false }),
  playerStateLook({ dead: false, disconnected: true }),
  playerStateLook({ dead: true, disconnected: true }),
];

/** The colours each state's stretch is drawn in, from the row look's custom properties. */
export const PLAYER_STATE_COLOURS: readonly string[] = [
  ...(['row', 'unready', 'alive', 'dead', 'away', 'away-dead'] as const).flatMap((k) => [
    `${k}-top`,
    `${k}-bottom`,
    `${k}-line`,
  ]),
  'bar',
  'bar-glow',
];

/** A stretch a player spent one way, on their row; dead, with the death that started it. */
export interface LifeSpan extends PlayerState {
  readonly row: number;
  readonly start: number;
  readonly end: number;
  /** The death the player was dead from; null while alive. */
  readonly death: DeadSpan | null;
}

/** Something that happened, on its row: what, and when on the game's clock. */
export interface TimelineEvent {
  readonly row: number;
  readonly kind: TimelineEventKind;
  readonly seconds: number;
  /** What kind of event it was (`Talent pick`, `Camp captured`, `Fort destroyed`, `Victory`). */
  readonly title: string;
  /** The text the chart marks it with instead of its kind's shape (a team level's number); null for the shape. */
  readonly mark: string | null;
  /**
   * What exactly, a line each, the main part first (`Bellowing Roar`, then `Level 10`); none when
   * the title says it all.
   */
  readonly details: readonly string[];
}

/**
 * The game as a timeline: its rows, each player's stretches alive or dead and connected or not, and
 * the events.
 */
export interface GameTimeline {
  /** When the replay starts on the game's clock: before the gates open, so negative. */
  readonly start: number;
  readonly rows: readonly GameTimelineRow[];
  readonly life: readonly LifeSpan[];
  readonly events: readonly TimelineEvent[];
}

/** What the timeline is made from. */
export interface GameTimelineSource {
  readonly timeline: ReplayTimeline;
  readonly deaths: ReplayDeaths;
  /** The map over the game; null until read (no captures or structures before then). */
  readonly map: MapState | null;
  /** Talents' names by the game's id; a talent not in it is named by its id. */
  readonly talentNames: Readonly<Record<string, string>>;
  readonly colorOf: (team: Team | null) => TeamColor | null;
  readonly teamName: (color: TeamColor | null) => string;
  readonly durationSeconds: number;
}

/**
 * The game as a timeline, from the replay's start (before the gates open): for each team (yours
 * first) a row of what the team did, standing until it was defeated (its core's fall) and dark
 * after, marked with the gates opening, each level it reached, each camp it captured, each fort and
 * keep it destroyed or lost (towns taken on Towers of Doom) and its victory or defeat; then a row
 * per player in stretches alive or
 * dead, connected or disconnected, marked with their talent picks.
 */
export function gameTimeline(source: GameTimelineSource): GameTimeline {
  const { timeline, deaths, map, talentNames, colorOf, teamName, durationSeconds } = source;
  const { lanes, spans } = deaths;
  const seconds = (loop: number) => timelineSeconds(timeline, loop);
  // the replay's start, before the gates open
  const start = Math.min(0, seconds(0));

  // the teams in the players' order (yours first), each then its players
  const teams = [...new Set(lanes.map((l) => l.team).filter((t) => t !== null))];
  const rows: GameTimelineRow[] = [];
  const teamRow = new Map<Team, number>();
  const playerRow = new Map<number, number>();
  for (const team of teams) {
    teamRow.set(team, rows.length);
    rows.push({ kind: 'team', team, color: colorOf(team) });
    lanes.forEach((l, lane) => {
      if (l.team !== team) return;
      playerRow.set(lane, rows.length);
      rows.push({ kind: 'player', lane });
    });
  }
  const laneOfSlot = new Map(lanes.map((l, i) => [l.slot, i]));
  const rowOfSlot = (slot: number | null) => {
    const lane = slot === null ? undefined : laneOfSlot.get(slot);
    return lane === undefined ? undefined : playerRow.get(lane);
  };
  const other = (team: Team): Team => (team === 0 ? 1 : 0);
  const sideOf = (team: Team) => `${teamName(colorOf(team))}'s`;

  // each team in the game until it was defeated (its core fell, the map's), then defeated to the end
  const life: LifeSpan[] = [];
  for (const [team, row] of teamRow) {
    const fell = map?.cores.find((c) => c.team === team)?.fell ?? null;
    const standing = { dead: false, disconnected: false, death: null };
    life.push({ row, start, end: fell ?? durationSeconds, ...standing });
    if (fell !== null && fell < durationSeconds)
      life.push({ row, start: fell, end: durationSeconds, ...standing, dead: true });
  }
  // each player's stretches: cut wherever they died, came back, dropped or reconnected
  for (const [lane, row] of playerRow) {
    const deathsOf = spans.filter((s) => s.lane === lane);
    const slot = lanes[lane]!.slot;
    const away = timeline.events
      .filter((e) => e.kind === 'disconnected' && e.slot === slot)
      .map((e) => ({ start: seconds(e.start), end: seconds(e.end ?? e.start) }));
    const cuts = [
      ...new Set([
        start,
        durationSeconds,
        ...[...deathsOf, ...away].flatMap((s) => [s.start, s.end]),
      ]),
    ]
      .filter((t) => t >= start && t <= durationSeconds)
      .sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const from = cuts[i]!;
      const to = cuts[i + 1]!;
      const mid = (from + to) / 2;
      const death = deathsOf.find((s) => s.start <= mid && mid < s.end) ?? null;
      const disconnected = away.some((s) => s.start <= mid && mid < s.end);
      const last = life.at(-1);
      // one stretch for as long as nothing changes
      if (
        last?.row === row &&
        last.end === from &&
        last.death === death &&
        last.disconnected === disconnected
      )
        life[life.length - 1] = { ...last, end: to };
      else life.push({ row, start: from, end: to, dead: death !== null, disconnected, death });
    }
  }

  const events: TimelineEvent[] = [];
  // the gates opening (0:00 on the game's clock), for each team
  if (start < 0)
    for (const row of teamRow.values())
      events.push({ row, kind: 'gates', seconds: 0, title: 'Gates open', mark: null, details: [] });
  // each level a team reached, when its first player reached it
  const reached = new Map<string, number>();
  for (const e of timeline.events) {
    if (e.kind !== 'level' || e.level === null || e.level < 2 || e.slot === null) continue;
    const team = lanes[laneOfSlot.get(e.slot) ?? -1]?.team;
    if (team === null || team === undefined) continue;
    const key = `${team}:${e.level}`;
    const at = seconds(e.start);
    if (!reached.has(key) || at < reached.get(key)!) reached.set(key, at);
  }
  for (const [key, at] of reached) {
    const [team, level] = key.split(':').map(Number) as [Team, number];
    const row = teamRow.get(team);
    if (row !== undefined)
      events.push({
        row,
        kind: 'level',
        seconds: at,
        title: 'Team level',
        mark: String(level),
        details: [`Level ${level}`],
      });
  }
  // the talents each player picked
  for (const e of timeline.events) {
    if (e.kind !== 'talent' || e.talent === null) continue;
    const row = rowOfSlot(e.slot);
    if (row === undefined) continue;
    const name = talentNames[e.talent] ?? e.talent;
    events.push({
      row,
      kind: 'talent',
      seconds: seconds(e.start),
      title: 'Talent pick',
      mark: null,
      details: [name, ...(e.level ? [`Level ${e.level}`] : [])],
    });
  }
  if (map) {
    // the camps each team captured
    const names = campNames(map.camps);
    map.camps.forEach((camp, i) => {
      for (const span of camp.spans) {
        const row = span.team === null ? undefined : teamRow.get(span.team);
        if (row !== undefined)
          events.push({
            row,
            kind: 'camp',
            seconds: span.start,
            title: 'Camp captured',
            mark: null,
            details: [names[i] ?? 'Camp'],
          });
      }
    });
    // the forts and keeps that fell, and the towns taken on Towers of Doom, on both sides
    const nameOf = (town: TownState) =>
      townName(
        town,
        map.towns
          .filter((t) => t.team === town.team && t.lane === town.lane)
          .sort((a, b) => Number(a.hall === 'keep') - Number(b.hall === 'keep')),
      );
    /**
     * A structure's fall or a town taken, on both teams' rows: the one that did it (`did`), the one
     * that lost it (`lost`), the same details.
     */
    const both = (
      winner: Team,
      loser: Team,
      at: number,
      did: string,
      lost: string,
      what: string,
    ) => {
      const won = teamRow.get(winner);
      const lose = teamRow.get(loser);
      if (won !== undefined)
        events.push({
          row: won,
          kind: 'structure',
          seconds: at,
          title: did,
          mark: null,
          details: [what],
        });
      if (lose !== undefined)
        events.push({
          row: lose,
          kind: 'structure',
          seconds: at,
          title: lost,
          mark: null,
          details: [what],
        });
    };
    for (const town of map.towns) {
      const hall = town.hall ? `${town.hall[0]!.toUpperCase()}${town.hall.slice(1)}` : 'Town';
      const where = `${sideOf(town.team)} ${nameOf(town)}`;
      if (town.fell !== null)
        both(other(town.team), town.team, town.fell, `${hall} destroyed`, `${hall} lost`, where);
      // on Towers of Doom: each time the town changed hands
      town.holds.slice(1).forEach((hold, i) => {
        const from = town.holds[i]!.team;
        both(hold.team, from, hold.start, 'Town taken', 'Town lost', where);
      });
    }
    // the game's end: a core's fall, the other team's victory and its team's defeat
    for (const core of map.cores)
      if (core.fell !== null) {
        const won = teamRow.get(other(core.team));
        const lost = teamRow.get(core.team);
        const at = core.fell;
        if (won !== undefined)
          events.push({
            row: won,
            kind: 'result',
            seconds: at,
            title: 'Victory',
            mark: null,
            details: [`${sideOf(core.team)} core destroyed`],
          });
        if (lost !== undefined)
          events.push({
            row: lost,
            kind: 'result',
            seconds: at,
            title: 'Defeat',
            mark: null,
            details: [`${sideOf(core.team)} core destroyed`],
          });
      }
  }
  events.sort((a, b) => a.seconds - b.seconds || a.row - b.row);
  return { start, rows, life, events };
}
