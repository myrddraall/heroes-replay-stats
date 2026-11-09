import type { MapUnitsInfo } from '@myrddraall/hero-data';
import type {
  BarSeriesOption,
  ChordSeriesOption,
  CustomSeriesOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from 'echarts/charts';
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type {
  ComposeOption,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemReturn,
} from 'echarts';
import type { ChartLook } from '../charts/chart-look';
import {
  axisText,
  CHART_GRID,
  chartTooltip,
  escapeHtml,
  gameTimeAxis,
} from '../charts/chart-options';
import { formatStatClock } from '../stat-tables/stat-format';
import type { DeathLane, ReplayDeaths } from './death-lanes';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { MapState, TeamColor, TownHold, TownLoss, TownState } from '../../model';
import { teamName } from '../stat-tables/team-rows';
import { type Fight, FIGHT_GAP_SECONDS, fightPlayers, type TalentPick } from './timeline-rows';
import { campRarity, townName } from './map-names';
import { campLabels, mercsAtRank } from './map-unit-heads';
import {
  type GameTimeline,
  TIMELINE_EVENTS,
  type TimelineEventKind,
  type TimelineEventLook,
  type PlayerStateKey,
  playerStateLook,
} from './game-timeline';

export type TimelineChartOption = ComposeOption<
  | CustomSeriesOption
  | ChordSeriesOption
  | BarSeriesOption
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
  | AriaComponentOption
>;

/**
 * Which chart of the game's timeline: the game over time (`timeline`), who killed whom
 * (`takedowns`), the fights, the camps' captures, the structures destroyed, or when each player
 * picked their talents (`talent-tiers`).
 */
export type TimelineChartKind =
  'timeline' | 'takedowns' | 'fights' | 'camps' | 'structures' | 'talent-tiers';

/** What the charts show. */
export interface TimelineChartModel {
  readonly deaths: ReplayDeaths;
  /** For `timeline`: the game as a timeline (null for the other charts), and the kinds of event hidden. */
  readonly game: GameTimeline | null;
  readonly hidden: readonly TimelineEventKind[];
  readonly fights: readonly Fight[];
  /** For `camps` and `structures`: the map over the game (null until read). */
  readonly map: MapState | null;
  /** A team's colour from your point of view. */
  readonly colorOf: (team: Team | null) => TeamColor | null;
  readonly talents: readonly TalentPick[];
  /** For `camps`: the map's camps and unit cards (heroes-assets); null without them. */
  readonly mapUnits?: MapUnitsInfo | null;
  /** The teams, your team first. */
  readonly teams: readonly TeamColor[];
  /** The game's length on its clock. */
  readonly durationSeconds: number;
  readonly look: ChartLook;
}

export function timelineOptions(
  kind: TimelineChartKind,
  model: TimelineChartModel,
): TimelineChartOption {
  switch (kind) {
    case 'timeline':
      return gameTimelineOptions(model);
    case 'takedowns':
      return takedownsOptions(model);
    case 'fights':
      return fightsOptions(model);
    case 'camps':
      return campsOptions(model);
    case 'structures':
      return structuresOptions(model);
    case 'talent-tiers':
      return talentTiersOptions(model);
  }
}

/** What every chart along the game's clock shares: the look, the time axis, wheel and drag zoom. */
function alongTheGame(
  { durationSeconds, look }: TimelineChartModel,
  description: string,
): TimelineChartOption {
  return {
    animationDuration: 600,
    textStyle: { fontFamily: look.font },
    aria: { enabled: true, label: { description } },
    grid: CHART_GRID,
    xAxis: gameTimeAxis(durationSeconds, look),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],
  };
}

/**
 * The fights: a bar at each for each team's players in it, the first team's rising and the
 * other's falling: those who died in the team's colour, those who took part and lived in a darker
 * shade of it.
 */
export function fightsOptions(model: TimelineChartModel): TimelineChartOption {
  const { fights, deaths, teams, look } = model;
  const [first, second] = teams;
  const colorOfLane = (lane: number) => deaths.lanes[lane]?.color;
  /** A team's players in a fight, by row: those who died, and those who took part and lived. */
  const sides = fights.map((fight) => {
    const players = fightPlayers(fight);
    const side = (color: TeamColor | undefined) => {
      const own = players.filter((lane) => colorOfLane(lane) === color);
      return {
        died: own.filter((lane) => fight.died.includes(lane)),
        lived: own.filter((lane) => !fight.died.includes(lane)),
      };
    };
    return { first: side(first), second: side(second) };
  });
  const reach = Math.max(
    1,
    ...sides.flatMap((s) => [
      s.first.died.length + s.first.lived.length,
      s.second.died.length + s.second.lived.length,
    ]),
  );
  const text = axisText(look);
  const bars = (
    color: TeamColor | undefined,
    which: 'first' | 'second',
    part: 'died' | 'lived',
  ): BarSeriesOption => ({
    type: 'bar',
    name: color ? `${teamName(color)} ${part === 'died' ? 'died' : 'took part and lived'}` : '',
    stack: 'fight',
    barWidth: 10,
    itemStyle: {
      color: color ? look.teams[color] : look.label,
      opacity: part === 'died' ? 1 : 0.45,
      borderRadius: 2,
    },
    data: fights.map((f, i) => [
      f.start,
      (which === 'first' ? 1 : -1) * sides[i]![which][part].length,
    ]),
  });
  return {
    ...alongTheGame(
      model,
      `The game's ${fights.length} fights (deaths within ${FIGHT_GAP_SECONDS} seconds of each other)` +
        (first && second
          ? `: above the middle ${teamName(first)}'s players in each fight, below it ${teamName(second)}'s; those who died in full colour, those who took part and lived darker.`
          : '.'),
    ),
    yAxis: {
      type: 'value',
      min: -reach,
      max: reach,
      interval: 1,
      name: 'Players in the fight',
      nameTextStyle: text,
      axisLabel: { ...text, formatter: (v: number) => String(Math.abs(v)) },
      axisLine: { show: true, lineStyle: { color: look.line } },
      splitLine: { lineStyle: { color: look.line, opacity: 0.5 } },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const index = Number((params as { dataIndex?: number }).dataIndex);
        const fight = fights[index];
        if (!fight) return '';
        const count = (list: readonly number[], lane: number) =>
          list.filter((l) => l === lane).length;
        const blowsBy = (lane: number) => fight.blows.filter((b) => b.lane === lane).length;
        const row = (name: string, blows: number, died: number) =>
          `<tr><td>${name}</td><td>${blows || ''}</td><td>${died || ''}</td></tr>`;
        const team = (color: TeamColor | undefined) => {
          if (!color) return '';
          const players = fightPlayers(fight).filter((lane) => colorOfLane(lane) === color);
          // the team's other units that landed killing blows (on the other team's players)
          const others = fight.blows
            .filter((b) => b.other !== null && colorOfLane(b.victim) !== color)
            .map((b) => b.other!);
          return (
            `<tbody theme="${color}"><tr><th scope="rowgroup" colspan="3" class="chart-tip__name">` +
            `${teamName(color)} · ${players.length} ${players.length === 1 ? 'player' : 'players'}</th></tr>` +
            players
              .map((lane) => row(who(deaths.lanes[lane]), blowsBy(lane), count(fight.died, lane)))
              .join('') +
            [...new Set(others)]
              .map((kind) => row(kind, others.filter((o) => o === kind).length, 0))
              .join('') +
            '</tbody>'
          );
        };
        return (
          `<div class="chart-tip__time">${formatStatClock(fight.start)} – ${formatStatClock(fight.end)}</div>` +
          `<table class="chart-tip__table"><thead><tr><th>Player</th><th>Killing blows</th><th>Deaths</th></tr></thead>` +
          team(first) +
          team(second) +
          '</table>'
        );
      },
      'item',
    ),
    series: [
      bars(first, 'first', 'died'),
      bars(first, 'first', 'lived'),
      bars(second, 'second', 'died'),
      bars(second, 'second', 'lived'),
    ],
  };
}

/**
 * A tooltip's lines as the timeline's: what it is in a team's colour (`theme`) with when at the top
 * right, then the main detail in white and the rest in grey.
 */
function rowTip(
  theme: TeamColor | null,
  title: string,
  when: string,
  main: string | null,
  minors: readonly string[] = [],
): string {
  return (
    `<div class="chart-tip__head"><span${theme ? ` theme="${theme}"` : ''} class="chart-tip__name">${escapeHtml(title)}</span>` +
    `<span class="chart-tip__time">${when}</span></div>` +
    (main ? `<div class="chart-tip__main">${escapeHtml(main)}</div>` : '') +
    minors.map((m) => `<div class="chart-tip__minor">${escapeHtml(m)}</div>`).join('')
  );
}

/** The time axis and rows of a chart whose row heads the page puts beside it (`TIMELINE_GRID`). */
function besideHeads(model: TimelineChartModel, rows: number): TimelineChartOption {
  return {
    grid: TIMELINE_GRID,
    xAxis: gameTimeAxis(model.durationSeconds, model.look, { fromEdge: true }),
    yAxis: {
      type: 'category',
      inverse: true,
      data: Array.from({ length: rows }, (_, i) => String(i)),
      // the rows' heads beside the chart name them; rows 2px apart as the tables', no lines
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
  };
}

/** A stretch of a camp's row: whose, how many of its capture's mercenaries were still in lane. */
interface CampPiece {
  readonly row: number;
  readonly start: number;
  readonly end: number;
  readonly team: Team | null;
  readonly inLane: number;
  readonly sent: number;
  /** Before the camp first came up. */
  readonly waiting: boolean;
  /** Captured: when the capture was; null otherwise. */
  readonly captured: number | null;
}

/**
 * The camps: a row per camp (its head beside the chart, in its level's rarity theme: siege camps
 * rare, bruiser camps epic, boss camps legendary), each stretch drawn as the tables' rows: the
 * camp's theme's while it was up for the taking, darker while empty (before it first came up,
 * and after a capture), and from each capture the capturing team's colour, moving towards the
 * darker empty camp's as the mercenaries it sent into lane died (all of the way once none were
 * left), until it came back.
 */
export function campsOptions(model: TimelineChartModel): TimelineChartOption {
  const { map, look, colorOf } = model;
  const camps = map?.camps ?? [];
  // each camp's label as the game shows it (`Knights`), its type's name without one
  const names = campLabels(camps, model.mapUnits ?? null);
  /** A camp's own theme's colours: its level's rarity (`campRarity`), or the neutral theme's. */
  const themeOf = (row: number) => look.themed?.[campRarity(camps[row]?.type ?? null) ?? ''];
  /**
   * Each camp's stretches: before it first came up; up for the taking; and captured, cut each time
   * one of the capture's mercenaries died, its share of them still in lane.
   */
  const pieces = camps.flatMap((camp, row): CampPiece[] => {
    const first = camp.spans[0]?.start ?? 0;
    return [
      ...(first > 0
        ? [
            {
              row,
              start: 0,
              end: first,
              team: null,
              inLane: 0,
              sent: 0,
              waiting: true,
              captured: null,
            },
          ]
        : []),
      ...camp.spans.flatMap((span): CampPiece[] => {
        if (span.team === null)
          return [
            {
              row,
              start: span.start,
              end: span.end,
              team: null,
              inLane: 0,
              sent: 0,
              waiting: false,
              captured: null,
            },
          ];
        const cuts = [
          ...new Set([
            span.start,
            span.end,
            ...span.mercs.map((m) => m.end).filter((t) => t > span.start && t < span.end),
          ]),
        ].sort((p, q) => p - q);
        return cuts.slice(0, -1).map((start, i) => {
          const end = cuts[i + 1]!;
          const mid = (start + end) / 2;
          const inLane = span.mercs.filter((m) => m.start <= mid && mid < m.end).length;
          return {
            row,
            start,
            end,
            team: span.team,
            inLane,
            sent: span.mercs.length,
            waiting: false,
            captured: span.start,
          };
        });
      }),
    ];
  });
  return {
    ...alongTheGame(
      model,
      'Each camp over the game: ' +
        camps
          .map(
            (c, i) => `${names[i]} captured ${c.spans.filter((s) => s.team !== null).length} times`,
          )
          .join('; ') +
        '.',
    ),
    ...besideHeads(model, camps.length),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }],
    tooltip: chartTooltip(
      look,
      (params) => {
        const piece = pieces[Number((params as { dataIndex?: number }).dataIndex)];
        // up for the taking, not up yet, or captured with none of its mercenaries left in lane says
        // nothing: it is the row itself
        if (!piece || piece.team === null || (piece.sent > 0 && piece.inLane === 0)) return '';
        const when = `${formatStatClock(piece.start)} – ${formatStatClock(piece.end)}`;
        // the mercenaries the capture sent, at their rank then (the game's scaling)
        const camp = camps[piece.row];
        const sent =
          camp && piece.captured !== null
            ? mercsAtRank(camp, model.mapUnits ?? null, piece.captured)
            : null;
        const number = (n: number | null) => (n === null ? '–' : Math.round(n).toLocaleString());
        return rowTip(colorOf(piece.team), 'Captured', when, names[piece.row] ?? 'Camp', [
          ...(piece.sent > 0
            ? [
                `${piece.inLane} of ${piece.sent} ${piece.sent === 1 ? 'mercenary' : 'mercenaries'} in lane`,
              ]
            : []),
          ...(sent
            ? [
                `Rank ${sent.rank} at capture`,
                ...sent.mercs.map(
                  (m) =>
                    `${m.count > 1 ? `${m.count} × ` : ''}${m.name}: ${number(m.life)} life, ${number(m.damage)} damage`,
                ),
              ]
            : []),
        ]);
      },
      'item',
    ),
    series: [
      {
        type: 'custom',
        id: 'camps',
        name: 'Camps',
        clip: true,
        renderItem: (params, api) => {
          const piece = pieces[params.dataIndex];
          if (!piece) return null;
          const color = colorOf(piece.team);
          // up for the taking, and empty (darker): the camp's own theme's rows
          const own = themeOf(piece.row);
          const up = stateFill(own, 'row', look);
          // captured: the team's colour, towards the darker empty camp's (as before it first came
          // up) by the share of its mercenaries lost, all of the way once none are left, until it
          // comes back (a capture with none sent stays the team's)
          const empty = stateFill(own, 'unready', look);
          const fill = piece.waiting
            ? empty
            : color
              ? mixFill(
                  stateFill(look.themed?.[color], 'alive', look),
                  empty,
                  piece.sent > 0 ? 1 - piece.inLane / piece.sent : 0,
                )
              : up;
          return rowStretch(api, piece.row, piece.start, piece.end, fill);
        },
        encode: { x: [1, 2], y: 0 },
        data: pieces.map((p) => [p.row, p.start, p.end]),
      },
    ],
  };
}

/** A row of the structures chart: a town or a core, who held it, and when it fell. */
export interface StructureRow {
  readonly name: string;
  /** Its unit type (a town's hall's, `TownTownHallL2`; a core's, `KingsCore`, Alterac Pass' generals). */
  readonly unit: string;
  /** Under the name in its head: the town's hall (`Fort`, `Keep`); none for a core. */
  readonly sub: string | null;
  /** The team whose side it is on. */
  readonly team: Team;
  readonly fell: number | null;
  readonly holds: readonly TownHold[];
  readonly town: TownState | null;
}

/**
 * The structures chart's rows: a row per town (your team's side first, top lane to bottom, each
 * lane's towns from the outer one in), then each side's core.
 */
export function structureRows(
  map: MapState | null,
  colorOf: (team: Team | null) => TeamColor | null,
  teams: readonly TeamColor[],
  durationSeconds: number,
): StructureRow[] {
  const order = { top: 0, middle: 1, bottom: 2 } as const;
  const teamOrder = (team: Team) => teams.indexOf(colorOf(team) as TeamColor);
  const towns = [...(map?.towns ?? [])].sort(
    (a, b) =>
      teamOrder(a.team) - teamOrder(b.team) ||
      (a.place ? order[a.place] : 0) - (b.place ? order[b.place] : 0) ||
      Number(a.hall === 'keep') - Number(b.hall === 'keep'),
  );
  const rows: StructureRow[] = [];
  for (const team of [...new Set(towns.map((t) => t.team))]) {
    const own = towns.filter((x) => x.team === team);
    for (const t of own) {
      const lane = own.filter((x) => x.lane === t.lane);
      const sub = t.hall ? `${t.hall[0]!.toUpperCase()}${t.hall.slice(1)}` : null;
      const unit = t.hall === 'keep' ? 'TownTownHallL3' : 'TownTownHallL2';
      rows.push({
        name: townName(t, lane),
        unit,
        sub,
        team,
        fell: t.fell,
        holds: t.holds,
        town: t,
      });
    }
    const core = map?.cores.find((c) => c.team === team);
    if (core) {
      const hold = { start: 0, end: core.fell ?? durationSeconds, team };
      rows.push({
        name: 'Core',
        unit: core.type,
        sub: null,
        team,
        fell: core.fell,
        holds: [hold],
        town: null,
      });
    }
  }
  return rows;
}

/** A mark on a structures row: a structure lost, or (Towers of Doom) the town taken. */
type StructureMark =
  | { readonly row: number; readonly seconds: number; readonly loss: TownLoss }
  | { readonly row: number; readonly seconds: number; readonly takenBy: Team };

/**
 * The structures: a row per town and core (`structureRows`, their heads beside the chart), each
 * drawn as the tables' rows in the colour of the team holding it while it stood (on Towers of Doom
 * towns change hands) and darker once it fell, with a notch for each tower, wall, gate and well
 * that fell in the town and a full-height one each time the town was taken.
 */
export function structuresOptions(model: TimelineChartModel): TimelineChartOption {
  const { map, look, colorOf, durationSeconds, teams } = model;
  const rows = structureRows(map, colorOf, teams, durationSeconds);
  const mark = look.extra['mat-sys-on-surface'] ?? look.label;
  /** Each row's stretches: held by a team while it stood, then fallen (its side's, darker). */
  const bars = rows.flatMap((r, row) => [
    ...r.holds.map((hold, i) => ({
      row,
      start: hold.start,
      end: hold.end,
      team: hold.team,
      fallen: false,
      next: r.holds[i + 1] ?? null,
    })),
    ...(r.fell !== null && r.fell < durationSeconds
      ? [{ row, start: r.fell, end: durationSeconds, team: r.team, fallen: true, next: null }]
      : []),
  ]);
  const marks: StructureMark[] = rows.flatMap((r, row) => [
    ...(r.town?.losses ?? []).map((loss) => ({ row, seconds: loss.seconds, loss })),
    ...r.holds.slice(1).map((h) => ({ row, seconds: h.start, takenBy: h.team })),
  ]);
  const sideOf = (team: Team) => `${teamName(colorOf(team) ?? 'blue')}'s`;
  /** A row's name in a tooltip: a town that changed hands named by whose side it is on. */
  const rowName = (r: StructureRow) =>
    r.holds.length > 1 ? `${r.name} on ${sideOf(r.team)} side` : `${sideOf(r.team)} ${r.name}`;
  const story = (r: StructureRow) =>
    r.holds.length > 1
      ? `${rowName(r)} taken ` +
        r.holds
          .slice(1)
          .map((h) => `by ${teamName(colorOf(h.team) ?? 'blue')} at ${formatStatClock(h.start)}`)
          .join(', ')
      : `${rowName(r)} ${r.fell === null ? 'stood' : `fell at ${formatStatClock(r.fell)}`}`;
  return {
    ...alongTheGame(model, `Each town and core over the game: ${rows.map(story).join('; ')}.`),
    ...besideHeads(model, rows.length),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }],
    tooltip: chartTooltip(
      look,
      (params) => {
        const p = params as { seriesId?: string; dataIndex?: number };
        if (p.seriesId === 'marks') {
          const m = marks[Number(p.dataIndex)];
          const r = m ? rows[m.row] : undefined;
          if (!m || !r) return '';
          const when = formatStatClock(m.seconds);
          if ('loss' in m) {
            const kind = `${m.loss.kind[0]!.toUpperCase()}${m.loss.kind.slice(1)}`;
            return rowTip(
              colorOf(m.loss.team),
              `${kind} lost`,
              when,
              rowName(r),
              r.sub ? [r.sub] : [],
            );
          }
          return rowTip(colorOf(m.takenBy), 'Town taken', when, rowName(r));
        }
        const bar = bars[Number(p.dataIndex)];
        const r = bar ? rows[bar.row] : undefined;
        if (!bar || !r) return '';
        const when = `${formatStatClock(bar.start)} – ${formatStatClock(bar.end)}`;
        const color = colorOf(bar.team);
        if (bar.fallen) return rowTip(color, 'Destroyed', when, rowName(r), r.sub ? [r.sub] : []);
        if (r.holds.length > 1)
          return rowTip(
            color,
            'Held',
            when,
            rowName(r),
            bar.next ? [`Taken by ${teamName(colorOf(bar.next.team) ?? 'blue')}`] : [],
          );
        const lost = r.town?.losses.length ?? 0;
        return rowTip(color, 'Standing', when, rowName(r), [
          ...(r.sub ? [r.sub] : []),
          ...(r.town ? [`${lost} ${lost === 1 ? 'structure' : 'structures'} lost around it`] : []),
        ]);
      },
      'item',
    ),
    series: [
      {
        type: 'custom',
        id: 'standing',
        name: 'Standing',
        clip: true,
        renderItem: (params, api) => {
          const bar = bars[params.dataIndex];
          const color = bar ? colorOf(bar.team) : null;
          const colours = color ? look.themed?.[color] : undefined;
          return bar && colours
            ? rowStretch(
                api,
                bar.row,
                bar.start,
                bar.end,
                stateFill(colours, bar.fallen ? 'dead' : 'alive', look),
              )
            : null;
        },
        encode: { x: [1, 2], y: 0 },
        data: bars.map((b) => [b.row, b.start, b.end]),
      },
      {
        type: 'custom',
        id: 'marks',
        name: 'Marks',
        // over the bars, so the notches are what the pointer finds where they cross
        z: 3,
        clip: true,
        renderItem: (_params, api) => {
          const row = Number(api.value(0));
          const [x, y] = api.coord([api.value(1), row]) as [number, number];
          const h = ((api.size?.([0, 1]) as number[])[1]! - 2) * Number(api.value(2));
          return {
            type: 'group',
            children: [
              // a wider, unseen area to hover than the notch itself
              {
                type: 'rect',
                transition: 'shape',
                shape: { x: x - 5, y: y - h / 2, width: 10, height: h },
                style: { fill: 'transparent' },
              },
              {
                type: 'rect',
                transition: 'shape',
                shape: { x: x - 1.5, y: y - h / 2, width: 3, height: h },
                style: { fill: mark },
              },
            ],
          };
        },
        encode: { x: 1, y: 0 },
        // a structure lost: most of the row; the town taken: all of it
        data: marks.map((m) => [m.row, m.seconds, 'loss' in m ? 0.7 : 1]),
      },
    ],
  };
}

/**
 * The talent tiers: a row per talent level, with a dot in the player's team colour when each
 * player picked that level's talent; within the row, your team's players just above the middle
 * and the other team's just below, so teammates picking together stay apart.
 */
export function talentTiersOptions(model: TimelineChartModel): TimelineChartOption {
  const { talents, deaths, teams, look } = model;
  const text = axisText(look);
  const levels = [...new Set(talents.map((t) => t.level))].sort((a, b) => a - b);
  /** A player's place within the row: teammates side by side, your team above. */
  const offset = (lane: number) => {
    const color = deaths.lanes[lane]?.color;
    const mates = deaths.lanes.filter((l) => l.color === color);
    const k = mates.indexOf(deaths.lanes[lane]!);
    const step = 0.4 / Math.max(1, mates.length);
    return color === teams[0] ? -0.05 - (mates.length - 1 - k) * step : 0.05 + k * step;
  };
  const rows = levels.map((_, i) => i);
  return {
    ...alongTheGame(
      model,
      'When each player picked their talent at each level: ' +
        levels
          .map((level) => {
            const at = talents.filter((t) => t.level === level).map((t) => t.seconds);
            return `level ${level} from ${formatStatClock(Math.min(...at))}`;
          })
          .join(', ') +
        '.',
    ),
    yAxis: {
      type: 'value',
      inverse: true,
      min: -0.5,
      max: levels.length - 0.5,
      axisLabel: {
        ...text,
        customValues: rows,
        formatter: (v: number) => `Level ${levels[v] ?? ''}`,
      },
      // the lines between the rows
      axisTick: { show: false, customValues: [...rows.map((r) => r - 0.5), levels.length - 0.5] },
      axisLine: { lineStyle: { color: look.line } },
      splitLine: { show: true, lineStyle: { color: look.line, opacity: 0.3 } },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const pick = talents[Number((params as { dataIndex?: number }).dataIndex)];
        if (!pick) return '';
        const lane = deaths.lanes[pick.lane];
        return (
          `<div class="chart-tip__time">${formatStatClock(pick.seconds)}</div>` +
          `<div${lane?.color ? ` theme="${lane.color}"` : ''}><span class="chart-tip__name">${who(lane)}</span> picked their level ${pick.level} talent</div>`
        );
      },
      'item',
    ),
    series: [
      {
        type: 'scatter',
        name: 'Talent picks',
        symbolSize: 9,
        data: talents.map((t) => {
          const color = deaths.lanes[t.lane]?.color;
          return {
            value: [t.seconds, levels.indexOf(t.level) + offset(t.lane)],
            itemStyle: { color: color ? look.teams[color] : look.label },
          };
        }),
      },
    ],
  };
}

const who = (lane: DeathLane | undefined) =>
  lane ? `${escapeHtml(lane.hero)} (${escapeHtml(lane.name)})` : '';

/**
 * The timeline's plot: from the chart's top to the time axis, `bottom` px above its bottom (the
 * axis's labels and name below it), so its rows line up with the row heads the page puts beside it.
 */
export const TIMELINE_GRID = {
  left: 0,
  right: 16,
  top: 0,
  bottom: 48,
  outerBoundsMode: 'none',
} as const;

/** A stretch's colours: its fill's top and bottom, and its 2px line. */
interface RowFill {
  readonly top: string;
  readonly bottom: string;
  readonly line: string;
}

/** A theme's colours (`readThemedColours`) for a stretch's look (`<state>-top` …). */
function stateFill(
  colours: Readonly<Record<string, string>> | undefined,
  state: PlayerStateKey,
  look: ChartLook,
): RowFill {
  return {
    top: colours?.[`${state}-top`] ?? look.label,
    bottom: colours?.[`${state}-bottom`] ?? look.label,
    line: colours?.[`${state}-line`] ?? look.label,
  };
}

/** `t` of the way from one `rgba()` colour to another (0 is `from`, 1 is `to`). */
function mixColour(from: string, to: string, t: number): string {
  const parse = (c: string) =>
    (/rgba?\(([^)]+)\)/.exec(c)?.[1] ?? '0,0,0,0').split(',').map(Number);
  const [a, b] = [parse(from), parse(to)];
  const at = (i: number) => (a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * t;
  return `rgba(${Math.round(at(0))}, ${Math.round(at(1))}, ${Math.round(at(2))}, ${at(3).toFixed(3)})`;
}

/** `t` of the way from one fill to another. */
function mixFill(from: RowFill, to: RowFill, t: number): RowFill {
  return {
    top: mixColour(from.top, to.top, t),
    bottom: mixColour(from.bottom, to.bottom, t),
    line: mixColour(from.line, to.line, t),
  };
}

/**
 * A stretch along a row as the tables' rows are drawn (`_score-row.scss`'s texture): the row's
 * whole height less 2px (rows 2px apart), a fill from its top colour to its bottom over a 2px
 * line. Its shapes move as the chart's marks do when it zooms and pans (animated the same), so the
 * marks stay on it.
 */
function rowStretch(
  api: CustomSeriesRenderItemAPI,
  row: number,
  start: number,
  end: number,
  fill: RowFill,
): CustomSeriesRenderItemReturn {
  const [x0, y] = api.coord([start, row]) as [number, number];
  const [x1] = api.coord([end, row]) as [number, number];
  const h = (api.size?.([0, 1]) as number[])[1]! - 2;
  const top = y - h / 2;
  const width = Math.max(1, x1 - x0);
  return {
    type: 'group',
    children: [
      {
        type: 'rect',
        transition: 'shape',
        shape: { x: x0, y: top, width, height: h },
        style: {
          fill: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: fill.top },
              { offset: 1, color: fill.bottom },
            ],
          },
        },
      },
      {
        type: 'rect',
        transition: 'shape',
        shape: { x: x0, y: top + h - 2, width, height: 2 },
        style: { fill: fill.line },
      },
    ],
  };
}

/**
 * The team events with a line down their team's players' rows: solid for the game's start and end,
 * dotted for each level.
 */
const LINED_EVENTS: Partial<Record<TimelineEventKind, 'solid' | 'dotted'>> = {
  gates: 'solid',
  result: 'solid',
  level: 'dotted',
};

/** An event's shape as ECharts draws it: a circle, or its corners as a path. */
function eventSymbol(look: TimelineEventLook): string {
  return look.points === null ? 'circle' : `path://M${look.points.split(' ').join('L')}Z`;
}

/**
 * The game's timeline: a row per team, then a row per player, your team first. Each player's row
 * is drawn as the tables' rows are (their team's row texture, the glowing bar at its head):
 * brighter while they were alive, the tables' own darker while dead, grey while disconnected
 * (darker grey while dead too); marks on the rows show each player's talent picks, and each team's
 * levels, camp captures and the forts, keeps and cores it destroyed (`hidden` kinds left out).
 */
export function gameTimelineOptions(model: TimelineChartModel): TimelineChartOption {
  const { game, deaths, look, hidden, durationSeconds } = model;
  if (!game) return {};
  const { rows, life, events } = game;
  const { lanes } = deaths;
  const mark = look.extra['mat-sys-on-surface'] ?? look.label;
  const ring = look.extra['mat-sys-surface'] ?? 'transparent';
  const laneOf = (row: number) => {
    const r = rows[row];
    return r?.kind === 'player' ? lanes[r.lane] : undefined;
  };
  /** A player's row's colours: their team's row look, read from the stylesheet. */
  const rowColours = (row: number) => {
    const r = rows[row];
    const color = r?.kind === 'team' ? r.color : laneOf(row)?.color;
    return color ? look.themed?.[color] : undefined;
  };
  const rowName = (row: number) => {
    const r = rows[row];
    if (!r) return '';
    return r.kind === 'team' ? (r.color ? teamName(r.color) : 'Team') : who(lanes[r.lane]);
  };
  const rowTheme = (row: number) => {
    const r = rows[row];
    const color = r?.kind === 'team' ? r.color : laneOf(row)?.color;
    return color ? ` theme="${color}"` : '';
  };
  const shown = TIMELINE_EVENTS.filter((e) => !hidden.includes(e.kind));
  const ofKind = (kind: TimelineEventKind) => events.filter((e) => e.kind === kind);
  /** A tooltip's first line: what it is, in its row's team colour, and when, at the top right. */
  const top = (row: number, title: string, when: string) =>
    `<div class="chart-tip__head"><span${rowTheme(row)} class="chart-tip__name">${escapeHtml(title)}</span>` +
    `<span class="chart-tip__time">${when}</span></div>`;
  /** A player's name on its own line, in their team's colour. */
  const whose = (row: number) =>
    `<div${rowTheme(row)}><span class="chart-tip__name">${rowName(row)}</span></div>`;
  return {
    ...alongTheGame(
      model,
      'The game over time: for each team the gates opening, its levels, camp captures, the forts and ' +
        'keeps it destroyed or lost, and its victory or defeat; for each player their time alive and dead, disconnected, and their talent picks. ' +
        lanes
          .map((l, i) => {
            const n = deaths.spans.filter((s) => s.lane === i).length;
            return `${l.hero} (${l.name}) died ${n === 1 ? 'once' : `${n} times`}`;
          })
          .join('; ') +
        '.',
    ),
    // the rows exactly the page's row heads' height (beside the chart, `TIMELINE_GRID`)
    grid: TIMELINE_GRID,
    // the plot starts at the chart's edge
    xAxis: gameTimeAxis(durationSeconds, look, { start: game.start, fromEdge: true }),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }],
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((_, i) => rowName(i)),
      // the rows' heads beside the chart name them; rows 2px apart as the tables', no lines
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const p = params as { seriesId?: string; dataIndex?: number };
        const i = Number(p.dataIndex);
        if (p.seriesId === 'life') {
          const span = life[i];
          // only the stretches dead or disconnected say anything: alive is the row itself
          if (!span || (!span.dead && !span.disconnected)) return '';
          // a team's: defeated, from its core's fall
          const when = `${formatStatClock(span.start)} – ${formatStatClock(span.end)}`;
          if (rows[span.row]?.kind === 'team')
            return top(span.row, 'Defeated', when) + '<div>Its core destroyed</div>';
          const death = span.death;
          /** A player as a list item, in their team's colour. */
          const item = (slot: number) => {
            const lane = lanes.find((l) => l.slot === slot);
            return `<li${lane?.color ? ` theme="${lane.color}"` : ''}><span class="chart-tip__name">${who(lane)}</span></li>`;
          };
          const list = (title: string, items: readonly string[]) =>
            items.length > 0
              ? `<div class="chart-tip__list-title">${title}</div><ul class="chart-tip__list">${items.join('')}</ul>`
              : '';
          const blow =
            death === null
              ? []
              : death.killerSlot !== null
                ? [item(death.killerSlot)]
                : death.killedBy !== null
                  ? [`<li>${escapeHtml(death.killedBy)}</li>`]
                  : [];
          // the others credited with the takedown
          const assists = (death?.killers ?? []).filter((k) => k !== death?.killerSlot).map(item);
          return (
            top(
              span.row,
              playerStateLook(span).label,
              `${when} (${Math.round(span.end - span.start)} s)`,
            ) +
            whose(span.row) +
            (death === null
              ? ''
              : blow.length === 0 && assists.length === 0
                ? '<div>No enemy hero was credited</div>'
                : list('Killing blow', blow) + list('Assists', assists))
          );
        }
        // an event: the kind of event in its row's team colour and when, then what exactly, and for a
        // player's, whose
        const event = ofKind(p.seriesId as TimelineEventKind)[i];
        return event
          ? top(event.row, event.title, formatStatClock(event.seconds)) +
              // what exactly: the first line the main part, white; the rest less important, grey
              event.details
                .map(
                  (d, n) =>
                    `<div class="${n === 0 ? 'chart-tip__main' : 'chart-tip__minor'}">${escapeHtml(d)}</div>`,
                )
                .join('') +
              (rows[event.row]?.kind === 'player' ? whose(event.row) : '')
          : '';
      },
      'item',
    ),
    series: [
      {
        type: 'custom',
        id: 'life',
        name: 'Players',
        // a stretch past the time axis's ends (zoomed) is cut at its edges
        clip: true,
        renderItem: (params, api) => {
          const span = life[params.dataIndex];
          const colours = rowColours(span?.row ?? -1);
          if (!span || !colours) return null;
          return rowStretch(
            api,
            span.row,
            span.start,
            span.end,
            stateFill(colours, playerStateLook(span).key, look),
          );
        },
        encode: { x: [1, 2], y: 0 },
        data: life.map((s) => [s.row, s.start, s.end]),
      },
      {
        type: 'custom',
        id: 'team-lines',
        name: 'Team lines',
        // from each team's gates, result and level-up marks (those shown), a line down across its
        // players' rows; its shape moves as the marks do when the chart zooms and pans (animated
        // the same), so it stays on them
        z: 2.5,
        clip: true,
        silent: true,
        renderItem: (_params, api) => {
          const [x, y0] = api.coord([api.value(2), api.value(0)]) as [number, number];
          const [, y1] = api.coord([api.value(2), api.value(1)]) as [number, number];
          const h = (api.size?.([0, 1]) as number[])[1]!;
          return {
            type: 'line',
            transition: 'shape',
            // to just short of the bottom row's 2px line (its stretch is the row less 2px)
            shape: { x1: x, y1: y0, x2: x, y2: y1 + (h - 2) / 2 - 3 },
            style: {
              stroke: mark,
              lineWidth: 1.5,
              lineDash: api.value(3) === 1 ? 'solid' : [2, 3],
              opacity: 0.8,
            },
          };
        },
        encode: { x: 2, y: 0 },
        data: events.flatMap((e) => {
          const line = LINED_EVENTS[e.kind];
          if (!line || hidden.includes(e.kind)) return [];
          // to the team's last player's row
          let last = e.row;
          while (rows[last + 1]?.kind === 'player') last++;
          return [[e.row, last, e.seconds, line === 'solid' ? 1 : 0]];
        }),
      },
      ...shown.map((e): ScatterSeriesOption =>
        e.text === null
          ? {
              type: 'scatter',
              id: e.kind,
              name: e.label,
              // over the bars
              z: 3,
              symbol: eventSymbol(e),
              symbolSize: 10,
              itemStyle: { color: mark, borderColor: ring, borderWidth: 1.5 },
              emphasis: { scale: 1.4 },
              data: ofKind(e.kind).map((ev) => [ev.seconds, ev.row]),
            }
          : {
              type: 'scatter',
              id: e.kind,
              name: e.label,
              // each event its own text (a team level's number) in the marks' colour, ringed in
              // the surface's to read over the bar; the symbol only the area to hover
              z: 3,
              symbol: 'circle',
              symbolSize: 16,
              itemStyle: { color: 'transparent' },
              label: {
                show: true,
                position: 'inside',
                formatter: (p: { value: unknown }) => String((p.value as unknown[])[2] ?? ''),
                color: mark,
                fontFamily: look.font,
                fontSize: 11,
                fontWeight: 'bold',
                textBorderColor: ring,
                textBorderWidth: 2.5,
              },
              emphasis: { scale: 1.3 },
              data: ofKind(e.kind).map((ev) => [ev.seconds, ev.row, ev.mark ?? '']),
            },
      ),
    ],
  };
}

/**
 * The takedowns chart: the ten players round a circle in their team's colour, and a band from
 * each to each enemy they took part in killing, as wide as how often.
 */
export function takedownsOptions({ deaths, look }: TimelineChartModel): TimelineChartOption {
  const { lanes, takedowns } = deaths;
  const node = (slot: number) => `slot ${slot}`;
  const laneOf = (slot: number) => lanes.find((l) => l.slot === slot);
  const takedownsOf = (slot: number) =>
    takedowns.filter((t) => t.killer === slot).reduce((sum, t) => sum + t.count, 0);
  /** A player's deaths: one each, however many enemies took part. */
  const deathsOf = (slot: number) =>
    deaths.spans.filter((s) => lanes[s.lane]?.slot === slot).length;
  return {
    animationDuration: 600,
    textStyle: { fontFamily: look.font },
    aria: {
      enabled: true,
      label: {
        description:
          'Who took part in killing whom: ' +
          takedowns
            .map(
              (t) => `${laneOf(t.killer)?.hero} killed ${laneOf(t.victim)?.hero} ${t.count} times`,
            )
            .join('; ') +
          '.',
      },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const p = params as {
          dataType?: string;
          data?: { source?: string; target?: string; value?: number; slot?: number };
        };
        if (p.dataType === 'edge') {
          const killer = laneOf(Number(p.data?.source?.split(' ')[1]));
          const victim = laneOf(Number(p.data?.target?.split(' ')[1]));
          const n = p.data?.value ?? 0;
          return `<div><span${killer?.color ? ` theme="${killer.color}"` : ''} class="chart-tip__name">${who(killer)}</span> took part in killing <span${victim?.color ? ` theme="${victim.color}"` : ''} class="chart-tip__name">${who(victim)}</span> ${n} ${n === 1 ? 'time' : 'times'}</div>`;
        }
        const lane = laneOf(Number(p.data?.slot));
        if (!lane) return '';
        const died = deathsOf(lane.slot);
        return (
          `<div class="chart-tip__row"${lane.color ? ` theme="${lane.color}"` : ''}><span class="chart-tip__name">${who(lane)}</span></div>` +
          `<div>${takedownsOf(lane.slot)} takedowns, died ${died} ${died === 1 ? 'time' : 'times'}</div>`
        );
      },
      'item',
    ),
    series: [
      {
        type: 'chord',
        center: ['50%', '50%'],
        radius: ['70%', '76%'],
        padAngle: 2,
        minAngle: 4,
        clockwise: true,
        data: lanes.map((l) => ({
          name: node(l.slot),
          slot: l.slot,
          itemStyle: { color: l.color ? look.teams[l.color] : look.label },
        })),
        links: takedowns.map((t) => ({
          source: node(t.killer),
          target: node(t.victim),
          value: t.count,
        })),
        label: {
          show: true,
          color: look.label,
          fontFamily: look.font,
          formatter: (p: { data?: { slot?: number } }) => laneOf(Number(p.data?.slot))?.hero ?? '',
        },
        lineStyle: { color: 'source', opacity: 0.45 },
        emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.8 } },
      } as ChordSeriesOption,
    ],
  };
}
