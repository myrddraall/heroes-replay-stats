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
import type { ComposeOption, CustomSeriesRenderItem } from 'echarts';
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
import type { CampState, MapState, TeamColor, TownState } from '../../model';
import { teamName } from '../stat-tables/team-rows';
import { type Fight, FIGHT_GAP_SECONDS, type TalentPick } from './timeline-rows';

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
 * Which chart of the game's timeline: each player's dead stretches (`deaths`), who killed whom
 * (`takedowns`), the fights, the camps' captures, the structures destroyed, or when each player
 * picked their talents (`talent-tiers`).
 */
export type TimelineChartKind =
  'deaths' | 'takedowns' | 'fights' | 'camps' | 'structures' | 'talent-tiers';

/** What the charts show. */
export interface TimelineChartModel {
  readonly deaths: ReplayDeaths;
  readonly fights: readonly Fight[];
  /** For `camps` and `structures`: the map over the game (null until read). */
  readonly map: MapState | null;
  /** A team's colour from your point of view. */
  readonly colorOf: (team: Team | null) => TeamColor | null;
  readonly talents: readonly TalentPick[];
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
    case 'deaths':
      return deathTimelineOptions(model);
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

/** A category axis of rows, the first at the top. */
function rowsAxis(rows: readonly string[], look: ChartLook): TimelineChartOption['yAxis'] {
  return {
    type: 'category',
    inverse: true,
    data: [...rows],
    axisLabel: axisText(look),
    axisLine: { lineStyle: { color: look.line } },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: look.line, opacity: 0.3 } },
  };
}

/**
 * The fights: a bar at each, rising by the heroes the first team killed (in its colour) and
 * falling by the heroes it lost (in the other team's).
 */
export function fightsOptions(model: TimelineChartModel): TimelineChartOption {
  const { fights, deaths, teams, look } = model;
  const [first, second] = teams;
  const lost = (fight: Fight, color: TeamColor | undefined) =>
    fight.died.filter((lane) => deaths.lanes[lane]?.color === color);
  const reach = Math.max(
    1,
    ...fights.flatMap((f) => [lost(f, first).length, lost(f, second).length]),
  );
  const text = axisText(look);
  const side = (color: TeamColor | undefined, sign: 1 | -1, victims: TeamColor | undefined) =>
    ({
      type: 'bar',
      name: color ? `${teamName(color)} kills` : '',
      stack: 'fight',
      barWidth: 10,
      itemStyle: { color: color ? look.teams[color] : look.label, borderRadius: 2 },
      data: fights.map((f) => [f.start, sign * lost(f, victims).length]),
    }) satisfies BarSeriesOption;
  return {
    ...alongTheGame(
      model,
      `The game's ${fights.length} fights (deaths within ${FIGHT_GAP_SECONDS} seconds of each other)` +
        (first && second
          ? `: above the middle the heroes ${teamName(first)} killed, below it the heroes ${teamName(second)} killed.`
          : '.'),
    ),
    yAxis: {
      type: 'value',
      min: -reach,
      max: reach,
      interval: 1,
      name: 'Heroes killed',
      nameTextStyle: text,
      axisLabel: { ...text, formatter: (v: number) => String(Math.abs(v)) },
      axisLine: { show: true, lineStyle: { color: look.line } },
      splitLine: { lineStyle: { color: look.line, opacity: 0.5 } },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const fight = fights[Number((params as { dataIndex?: number }).dataIndex)];
        if (!fight) return '';
        const list = (color: TeamColor | undefined) =>
          lost(fight, color)
            .map((lane) => who(deaths.lanes[lane]))
            .join(', ') || 'no one';
        return (
          `<div class="chart-tip__time">${formatStatClock(fight.start)} – ${formatStatClock(fight.end)}</div>` +
          [first, second]
            .filter((c) => c !== undefined)
            .map(
              (c) =>
                `<div class="chart-tip__row" theme="${c}"><span class="chart-tip__name">${teamName(c)} lost</span><span></span><span class="chart-tip__value">${lost(fight, c).length}</span></div><div>${list(c)}</div>`,
            )
            .join('')
        );
      },
      'item',
    ),
    series: [side(first, 1, second), side(second, -1, first)],
  };
}

/** A bar along a row, drawn by the custom series: `[row, start, end, colour]`. */
type Span = readonly [number, number, number, string];

/** Draws `[row, start, end, colour]` as a bar along the row; `opacity` per item via its style. */
function spanBars(height = 0.6): CustomSeriesRenderItem {
  return (_params, api) => {
    const row = Number(api.value(0));
    const [x0, y] = api.coord([api.value(1), row]) as [number, number];
    const [x1] = api.coord([api.value(2), row]) as [number, number];
    const h = (api.size?.([0, 1]) as number[])[1]! * height;
    return {
      type: 'rect',
      shape: { x: x0, y: y - h / 2, width: Math.max(2, x1 - x0), height: h, r: 2 },
      style: api.style(),
    };
  };
}

/** Names camps by type, numbering the types with several: Siege Camp 1, Siege Camp 2, Boss Camp. */
function campNames(camps: readonly CampState[]): string[] {
  return camps.map((c) => {
    const type = c.type ?? 'Camp';
    const same = camps.filter((o) => (o.type ?? 'Camp') === type);
    return same.length > 1 ? `${type} ${same.indexOf(c) + 1}` : type;
  });
}

/**
 * The camps: a row per camp, faint while it was up for the taking, and in the capturing team's
 * colour from each capture until it came back.
 */
export function campsOptions(model: TimelineChartModel): TimelineChartOption {
  const { map, look, colorOf } = model;
  const camps = map?.camps ?? [];
  const names = campNames(camps);
  const spans = camps.flatMap((camp, row) => camp.spans.map((span) => ({ camp: row, span })));
  const colour = (team: Team | null) => {
    const c = colorOf(team);
    return c ? look.teams[c] : look.label;
  };
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
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }],
    yAxis: rowsAxis(names, look),
    tooltip: chartTooltip(
      look,
      (params) => {
        const hit = spans[Number((params as { dataIndex?: number }).dataIndex)];
        if (!hit) return '';
        const { span } = hit;
        const name = escapeHtml(names[hit.camp] ?? 'Camp');
        const time = `${formatStatClock(span.start)} – ${formatStatClock(span.end)}`;
        const c = colorOf(span.team);
        return span.team === null
          ? `<div class="chart-tip__name">${name}</div><div class="chart-tip__time">Up ${time}</div>`
          : `<div class="chart-tip__name">${name}</div><div class="chart-tip__time">${time}</div>` +
              `<div${c ? ` theme="${c}"` : ''}><span class="chart-tip__name">${c ? teamName(c) : 'A team'}</span> captured it; it came back at ${formatStatClock(span.end)}</div>`;
      },
      'item',
    ),
    series: [
      {
        type: 'custom',
        name: 'Camps',
        renderItem: spanBars(),
        encode: { x: [1, 2], y: 0 },
        data: spans.map(({ camp, span }) => ({
          value: [camp, span.start, span.end],
          itemStyle: {
            color: colour(span.team),
            opacity: span.team === null ? 0.18 : 0.85,
          },
        })),
      },
    ],
  };
}

/** A row of the structures chart: a town or a core, and when it fell. */
interface StructureRow {
  readonly name: string;
  readonly team: Team;
  readonly fell: number | null;
  readonly town: TownState | null;
}

/** A town's name: where its lane runs and its hall (Top fort, Bottom keep). */
function townName(town: TownState): string {
  const place = town.place ? town.place[0]!.toUpperCase() + town.place.slice(1) : 'Lane';
  return `${place} ${town.hall ?? 'town'}`;
}

/**
 * The structures: a row per town (your team's first, top lane to bottom, each lane's fort then its
 * keep) and a row per core, in the owning team's colour while it stood, with a tick for each
 * tower, wall, gate and well that fell in the town.
 */
export function structuresOptions(model: TimelineChartModel): TimelineChartOption {
  const { map, look, colorOf, durationSeconds, teams } = model;
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
    for (const t of towns.filter((x) => x.team === team))
      rows.push({ name: townName(t), team, fell: t.fell, town: t });
    const core = map?.cores.find((c) => c.team === team);
    if (core) rows.push({ name: 'Core', team, fell: core.fell, town: null });
  }
  const colour = (team: Team) => {
    const c = colorOf(team);
    return c ? look.teams[c] : look.label;
  };
  const ticks = rows.flatMap((r, row) => (r.town?.losses ?? []).map((loss) => ({ row, loss })));
  const text = axisText(look);
  const label = (r: StructureRow) => {
    const c = colorOf(r.team);
    return c ? `{${c}|${r.name}}` : r.name;
  };
  const standing = rows.map((r, row): Span => [row, 0, r.fell ?? durationSeconds, colour(r.team)]);
  return {
    ...alongTheGame(
      model,
      'Each town and core over the game: ' +
        rows
          .map((r) => {
            const c = colorOf(r.team);
            return `${c ? teamName(c) : ''} ${r.name} ${r.fell === null ? 'stood' : `fell at ${formatStatClock(r.fell)}`}`;
          })
          .join('; ') +
        '.',
    ),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }],
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map(label),
      axisLabel: {
        ...text,
        rich: { blue: { color: look.teams.blue }, red: { color: look.teams.red } },
      },
      axisLine: { lineStyle: { color: look.line } },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: look.line, opacity: 0.3 } },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const p = params as { seriesIndex?: number; dataIndex?: number };
        if (p.seriesIndex === 1) {
          const hit = ticks[Number(p.dataIndex)];
          const r = hit ? rows[hit.row] : undefined;
          if (!hit || !r) return '';
          const c = colorOf(r.team);
          return (
            `<div class="chart-tip__time">${formatStatClock(hit.loss.seconds)}</div>` +
            `<div><span${c ? ` theme="${c}"` : ''} class="chart-tip__name">${c ? teamName(c) : ''} ${escapeHtml(r.name)}</span> lost a ${hit.loss.kind}</div>`
          );
        }
        const r = rows[Number(p.dataIndex)];
        if (!r) return '';
        const c = colorOf(r.team);
        const lost = r.town?.losses.length ?? 0;
        return (
          `<div><span${c ? ` theme="${c}"` : ''} class="chart-tip__name">${c ? teamName(c) : ''} ${escapeHtml(r.name)}</span></div>` +
          `<div class="chart-tip__time">${r.fell === null ? 'Stood to the end' : `Destroyed at ${formatStatClock(r.fell)}`}</div>` +
          (r.town
            ? `<div>${lost} ${lost === 1 ? 'structure' : 'structures'} lost around it</div>`
            : '')
        );
      },
      'item',
    ),
    series: [
      {
        type: 'custom',
        name: 'Standing',
        renderItem: spanBars(),
        encode: { x: [1, 2], y: 0 },
        data: standing.map(([row, start, end, c]) => ({
          value: [row, start, end],
          itemStyle: { color: c, opacity: 0.55 },
        })),
      },
      {
        type: 'custom',
        name: 'Lost',
        renderItem: (_params, api) => {
          const row = Number(api.value(0));
          const [x, y] = api.coord([api.value(1), row]) as [number, number];
          const h = (api.size?.([0, 1]) as number[])[1]! * 0.8;
          return {
            type: 'rect',
            shape: { x: x - 1.5, y: y - h / 2, width: 3, height: h },
            style: { fill: look.label },
          };
        },
        encode: { x: 1, y: 0 },
        data: ticks.map(({ row, loss }) => [row, loss.seconds]),
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
 * The death timeline: a row per player, your team's first, with a bar in the player's team
 * colour for each stretch they spent dead.
 */
export function deathTimelineOptions(model: TimelineChartModel): TimelineChartOption {
  const { deaths, look } = model;
  const { lanes, spans } = deaths;
  const colour = (lane: DeathLane | undefined) =>
    lane?.color ? look.teams[lane.color] : look.label;
  const renderItem: CustomSeriesRenderItem = (_params, api) => {
    const lane = Number(api.value(0));
    const [x0, y] = api.coord([api.value(1), lane]) as [number, number];
    const [x1] = api.coord([api.value(2), lane]) as [number, number];
    const height = (api.size?.([0, 1]) as number[])[1]! * 0.6;
    return {
      type: 'rect',
      shape: { x: x0, y: y - height / 2, width: Math.max(2, x1 - x0), height, r: 2 },
      style: { fill: colour(lanes[lane]) },
    };
  };
  return {
    ...alongTheGame(
      model,
      "Each player's time dead over the game. " +
        lanes
          .map(
            (l, i) =>
              `${l.hero} (${l.name}) died ${spans.filter((s) => s.lane === i).length} times`,
          )
          .join('; ') +
        '.',
    ),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }],
    yAxis: rowsAxis(
      lanes.map((l) => l.hero),
      look,
    ),
    tooltip: chartTooltip(
      look,
      (params) => {
        const span = spans[Number((params as { dataIndex?: number }).dataIndex)];
        if (!span) return '';
        const lane = lanes[span.lane];
        const killers = span.killers.map((k) => who(lanes.find((l) => l.slot === k)));
        return (
          `<div class="chart-tip__row"${lane?.color ? ` theme="${lane.color}"` : ''}><span class="chart-tip__name">${who(lane)}</span></div>` +
          `<div class="chart-tip__time">Dead ${formatStatClock(span.start)} – ${formatStatClock(span.end)} (${Math.round(span.end - span.start)} s)</div>` +
          (killers.length > 0
            ? `<div>Killed by ${killers.join(', ')}</div>`
            : '<div>No enemy hero was credited</div>')
        );
      },
      'item',
    ),
    series: [
      {
        type: 'custom',
        name: 'Dead',
        renderItem,
        encode: { x: [1, 2], y: 0 },
        data: spans.map((s) => [s.lane, s.start, s.end]),
      },
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
