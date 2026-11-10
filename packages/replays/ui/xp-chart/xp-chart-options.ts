import type { LineSeriesOption } from 'echarts/charts';
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type { ComposeOption } from 'echarts/core';
import type { Team } from '@myrddraall/heroprotocol-db';
import { TEAM_LEVEL_XP } from '../../model';
import type { ChartLook } from '../charts/chart-look';
import {
  axisText,
  CHART_GRID,
  chartTooltip,
  escapeHtml,
  firstIndex,
  gameTimeAxis,
  INTEGER,
  niceCeiling,
} from '../charts/chart-options';
import type { GameEvent } from '../charts/game-events';
import { formatStat, formatStatClock, formatStatCompact } from '../stat-tables/stat-format';
import { XP_SOURCES, XP_STACK, type XpCurve, type XpCurvePoint, type XpSource } from './xp-curves';

export type XpChartOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
  | MarkLineComponentOption
  | AriaComponentOption
>;

/**
 * Which XP chart: each team's XP so far, the XP it gained each minute, the lead one team had over
 * the other, or one team's XP by source.
 */
export type XpChartKind = 'over-time' | 'per-minute' | 'advantage' | 'sources';

/** What the charts show. */
export interface XpChartModel {
  readonly curves: readonly XpCurve[];
  /** The sources counted. */
  readonly chosen: readonly XpSource[];
  readonly look: ChartLook;
  readonly locale: string;
  /** The game's turns, for the advantage chart's tooltip. */
  readonly events: readonly GameEvent[];
  /** The team the sources chart shows; its first curve's when null. */
  readonly team: Team | null;
}

/** Where every XP line starts: no XP at the gates opening. */
const START: XpCurvePoint = {
  seconds: 0,
  level: 1,
  xp: 0,
  perMinute: 0,
  bySource: { minionXP: 0, creepXP: 0, structureXP: 0, heroXP: 0, trickleXP: 0 },
};

/** The options for one kind of XP chart. */
export function xpOptions(kind: XpChartKind, model: XpChartModel): XpChartOption {
  switch (kind) {
    case 'over-time':
      return xpChartOptions(model);
    case 'per-minute':
      return xpRateOptions(model);
    case 'advantage':
      return xpAdvantageOptions(model);
    case 'sources':
      return xpSourcesOptions(model);
  }
}

/**
 * The XP chart: each team's XP over the game as a line, on an XP axis and, when every source is
 * counted, a level axis ticked at the XP each level is reached.
 */
export function xpChartOptions(model: XpChartModel): XpChartOption {
  const { curves, look, locale } = model;
  const text = axisText(look);
  const max = niceCeiling(Math.max(0, ...curves.flatMap((c) => c.points.map((p) => p.xp))));
  // the level axis only reads true when every source is counted
  const levels = model.chosen.length === XP_SOURCES.length;
  const thresholds = TEAM_LEVEL_XP.filter((l) => l.xp <= max).map((l) => l.xp);
  const lines = curves.map((c) => [START, ...c.points]);
  return {
    ...common(model, lines, "Each team's XP over the game, a point every minute", (shown) =>
      teamsTip(shown, lead(shown, locale), (point) => [
        point.level === null ? '' : `Level ${point.level}`,
        `${formatStat(point.xp, INTEGER, locale)} XP`,
      ]),
    ),
    yAxis: [
      {
        type: 'value',
        min: 0,
        max,
        name: 'XP',
        nameTextStyle: text,
        axisLabel: { ...text, formatter: (v: number) => formatStatCompact(v, INTEGER, locale) },
        axisLine: { show: true, lineStyle: { color: look.line } },
        // the level axis draws the grid when it shows
        splitLine: { show: !levels, lineStyle: { color: look.line, opacity: 0.5 } },
      },
      {
        type: 'value',
        show: levels,
        position: 'right',
        min: 0,
        max,
        name: 'Level',
        nameTextStyle: text,
        axisLabel: {
          ...text,
          hideOverlap: true,
          customValues: thresholds,
          formatter: (v: number) => String(TEAM_LEVEL_XP.find((l) => l.xp === v)?.level ?? ''),
        },
        axisTick: { show: true, customValues: thresholds },
        axisLine: { show: true, lineStyle: { color: look.line } },
        splitLine: { show: levels, lineStyle: { color: look.line, opacity: 0.5 } },
      },
    ],
    dataZoom: zoom([0, 1]),
    series: lines.map((points, i) => teamLine(curves[i]!, points, (p) => p.xp, look, true)),
  };
}

/** The XP per minute chart: the rate each team's XP came in at, a point every minute. */
export function xpRateOptions(model: XpChartModel): XpChartOption {
  const { curves, look, locale } = model;
  const lines = curves.map((c) => c.points);
  return {
    ...common(model, lines, 'The XP each team gained per minute over the game', (shown) =>
      teamsTip(shown, '', (point) => ['', `${formatStat(point.perMinute, INTEGER, locale)} XP`]),
    ),
    yAxis: valueAxis('XP per minute', look, locale),
    dataZoom: zoom(0),
    series: lines.map((points, i) => teamLine(curves[i]!, points, (p) => p.perMinute, look, false)),
  };
}

/**
 * The advantage chart: how far ahead in XP one team was over the game, above the middle (in its
 * colour) while the first team led and below it (in the other's) while the second did. Its
 * tooltip lists the game's turns since the previous minute.
 */
export function xpAdvantageOptions(model: XpChartModel): XpChartOption {
  const { curves, look, locale, events } = model;
  const [above, below] = curves;
  const lines = curves.map((c) => [START, ...c.points]);
  // only where both teams have a point
  const first = (lines[0] ?? []).slice(0, lines[1]?.length ?? 0);
  const gap = first.map((p, i) => p.xp - lines[1]![i]!.xp);
  const reach = niceCeiling(Math.max(1, ...gap.map(Math.abs)));
  const text = axisText(look);
  const lineOf = withCrossings(first.map((p, i) => [p.seconds, gap[i]!] as const));
  /** The lead's line on one side of the middle, flat along it while the other team leads. */
  const side = (curve: XpCurve | undefined, sign: 1 | -1): LineSeriesOption => {
    const colour = curve ? look.teams[curve.color] : look.label;
    return {
      type: 'line',
      name: curve?.name ?? '',
      data: lineOf.map(({ seconds, lead, point }) => ({
        value: [seconds, sign > 0 ? Math.max(0, lead) : Math.min(0, lead)],
        // a dot on the minute's points while this side leads
        symbolSize: point && lead * sign > 0 ? 6 : 0,
      })),
      showSymbol: true,
      lineStyle: { width: 2, color: colour },
      itemStyle: { color: colour },
      areaStyle: { color: colour, opacity: 0.25, origin: 0 },
    };
  };
  return {
    ...common(
      model,
      lines,
      `How far ahead in XP one team was over the game: above the middle ${above?.name ?? ''}, below it ${below?.name ?? ''}`,
      () => '',
    ),
    // the hovered minute by its time: the lines also bend where the lead changes hands
    tooltip: chartTooltip(look, (params) => {
      const first0: unknown = Array.isArray(params) ? params[0] : params;
      const at = (first0 as { value?: [number, number] } | undefined)?.value?.[0];
      if (at === undefined || first.length === 0) return '';
      const index = first.reduce(
        (best, p, i) => (Math.abs(p.seconds - at) < Math.abs(first[best]!.seconds - at) ? i : best),
        0,
      );
      const shown = curves
        .map((curve, i) => ({ curve, point: lines[i]?.[index] }))
        .filter((t): t is ShownPoint => !!t.point);
      const since = first[index - 1]?.seconds ?? -1;
      const now = first[index]?.seconds ?? 0;
      const turns = events.filter((e) => e.seconds > since && e.seconds <= now);
      return (
        teamsTip(shown, lead(shown, locale), (point) => [
          point.level === null ? '' : `Level ${point.level}`,
          `${formatStat(point.xp, INTEGER, locale)} XP`,
        ]) + eventList(turns)
      );
    }),
    yAxis: {
      type: 'value',
      min: -reach,
      max: reach,
      name: 'XP lead',
      nameTextStyle: text,
      // the lead either way, as a size
      axisLabel: {
        ...text,
        formatter: (v: number) => formatStatCompact(Math.abs(v), INTEGER, locale),
      },
      axisLine: { show: true, lineStyle: { color: look.line } },
      splitLine: { lineStyle: { color: look.line, opacity: 0.5 } },
    },
    dataZoom: zoom(0),
    series: [
      {
        ...side(above, 1),
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: look.label, type: 'solid', width: 1 },
          data: [{ yAxis: 0 }],
        },
      },
      side(below, -1),
    ],
  };
}

/** A point of the lead's line: a minute's (`point`), or where the lead changes hands. */
interface LeadPoint {
  readonly seconds: number;
  readonly lead: number;
  readonly point: boolean;
}

/** The lead's points, with one added at the middle wherever the line crosses it. */
export function withCrossings(points: readonly (readonly [number, number])[]): LeadPoint[] {
  return points.flatMap(([seconds, lead], i): LeadPoint[] => {
    const previous = points[i - 1];
    const here = { seconds, lead, point: true };
    if (!previous || previous[1] * lead >= 0) return [here];
    const [s0, l0] = previous;
    const cross = s0 + ((seconds - s0) * l0) / (l0 - lead);
    return [{ seconds: cross, lead: 0, point: false }, here];
  });
}

/**
 * The sources chart: one team's XP over the game, stacked by where it came from (the counted
 * sources, in `XP_STACK` order), each in its colour (`--xp-source-<id>`).
 */
export function xpSourcesOptions(model: XpChartModel): XpChartOption {
  const { curves, look, locale, chosen } = model;
  const curve = curves.find((c) => c.team === model.team) ?? curves[0];
  if (!curve) return {};
  const points = [START, ...curve.points];
  const stack = XP_STACK.filter((s) => chosen.includes(s));
  const colour = (s: XpSource) => look.extra[`xp-source-${s}`] ?? look.label;
  const label = (s: XpSource) => XP_SOURCES.find((x) => x.id === s)?.label ?? s;
  const xp = (v: number) => `${formatStat(v, INTEGER, locale)} XP`;
  return {
    ...common(
      model,
      [points],
      `${curve.name}'s XP over the game by where it came from`,
      (_shown, index) => {
        const point = points[index];
        if (!point) return '';
        const total = stack.reduce((sum, s) => sum + point.bySource[s], 0);
        // the top of the stack first, as it reads
        const rows = [...stack]
          .reverse()
          .map(
            (s) =>
              `<div class="chart-tip__row"><span><span class="chart-tip__swatch" style="background:${colour(s)}"></span>${label(s)}</span>` +
              `<span></span><span class="chart-tip__value">${xp(point.bySource[s])}</span></div>`,
          )
          .join('');
        return (
          `<div class="chart-tip__time">${formatStatClock(point.seconds)}</div>` +
          `<div class="chart-tip__row" theme="${curve.color}"><span class="chart-tip__name">${curve.name}</span>` +
          `<span></span><span class="chart-tip__value">${xp(total)}</span></div>${rows}`
        );
      },
    ),
    yAxis: valueAxis('XP', look, locale),
    dataZoom: zoom(0),
    series: stack.map((s): LineSeriesOption => ({
      type: 'line',
      name: label(s),
      stack: 'xp',
      data: points.map((p) => [p.seconds, p.bySource[s]]),
      showSymbol: false,
      lineStyle: { width: 1, color: colour(s) },
      itemStyle: { color: colour(s) },
      areaStyle: { color: colour(s), opacity: 0.85 },
    })),
  };
}

interface ShownPoint {
  readonly curve: XpCurve;
  readonly point: XpCurvePoint;
}

/**
 * What every XP chart shares: the look, the game-time axis, the tooltip (built by `tip` from the
 * hovered point of each line) and a description for screen readers.
 */
function common(
  model: XpChartModel,
  lines: readonly (readonly XpCurvePoint[])[],
  what: string,
  tip: (shown: readonly ShownPoint[], index: number) => string,
): XpChartOption {
  const { curves, look, locale } = model;
  const end = Math.max(0, ...lines.flatMap((l) => l.map((p) => p.seconds)));
  return {
    animationDuration: 600,
    textStyle: { fontFamily: look.font },
    aria: { enabled: true, label: { description: `${what}. ${ends(curves, locale)}.` } },
    grid: CHART_GRID,
    xAxis: gameTimeAxis(end, look),
    tooltip: chartTooltip(look, (params) => {
      const index = firstIndex(params);
      if (index === null) return '';
      const shown = curves
        .map((curve, i) => ({ curve, point: lines[i]?.[index] }))
        .filter((t): t is ShownPoint => !!t.point);
      return tip(shown, index);
    }),
  };
}

/** The tooltip's time, an optional lead line, then a row per team: its name and two cells. */
function teamsTip(
  shown: readonly ShownPoint[],
  leadLine: string,
  cells: (point: XpCurvePoint) => readonly [string, string],
): string {
  const first = shown[0];
  if (!first) return '';
  const rows = shown
    .map(({ curve, point }) => {
      const [a, b] = cells(point);
      return (
        `<div class="chart-tip__row" theme="${curve.color}"><span class="chart-tip__name">${curve.name}</span>` +
        `<span>${a}</span><span class="chart-tip__value">${b}</span></div>`
      );
    })
    .join('');
  return `<div class="chart-tip__time">${formatStatClock(first.point.seconds)}</div>${leadLine}${rows}`;
}

/** Which team is ahead, by how many levels and how much XP. */
function lead(shown: readonly ShownPoint[], locale: string): string {
  const [a, b] = shown;
  if (!a || !b || a.point.xp === b.point.xp) return '';
  const [ahead, behind] = a.point.xp > b.point.xp ? [a, b] : [b, a];
  const by =
    ahead.point.level !== null && behind.point.level !== null
      ? ahead.point.level - behind.point.level
      : null;
  return (
    `<div class="chart-tip__lead" theme="${ahead.curve.color}">${ahead.curve.name} ahead by ` +
    (by ? `${by} ${by === 1 ? 'level' : 'levels'}, ` : '') +
    `${formatStat(ahead.point.xp - behind.point.xp, INTEGER, locale)} XP</div>`
  );
}

/** The game's turns, each in the colour of the team it was about. */
function eventList(events: readonly GameEvent[]): string {
  if (events.length === 0) return '';
  const items = events
    .map(
      (e) =>
        `<li class="chart-tip__event"${e.color ? ` theme="${e.color}"` : ''}>` +
        `<span class="chart-tip__time">${formatStatClock(e.seconds)}</span> ${escapeHtml(e.text)}</li>`,
    )
    .join('');
  return `<ul class="chart-tip__events">${items}</ul>`;
}

/** A plain value axis from 0. */
function valueAxis(name: string, look: ChartLook, locale: string): XpChartOption['yAxis'] {
  const text = axisText(look);
  return {
    type: 'value',
    min: 0,
    name,
    nameTextStyle: text,
    axisLabel: { ...text, formatter: (v: number) => formatStatCompact(v, INTEGER, locale) },
    axisLine: { show: true, lineStyle: { color: look.line } },
    splitLine: { lineStyle: { color: look.line, opacity: 0.5 } },
  };
}

/** Wheel and pinch zoom, drag to pan, on the time axis and the value axis (or axes) given. */
function zoom(yAxisIndex: number | number[]): DataZoomComponentOption[] {
  return [
    { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
    { type: 'inside', yAxisIndex, filterMode: 'none' },
  ];
}

/** A team's line in its colour. */
function teamLine(
  curve: XpCurve,
  points: readonly XpCurvePoint[],
  value: (point: XpCurvePoint) => number,
  look: ChartLook,
  smooth: boolean,
): LineSeriesOption {
  return {
    type: 'line',
    name: curve.name,
    yAxisIndex: 0,
    data: points.map((p) => [p.seconds, value(p)]),
    smooth,
    showSymbol: true,
    symbolSize: 6,
    lineStyle: { width: 2, color: look.teams[curve.color] },
    itemStyle: { color: look.teams[curve.color] },
  };
}

/** Where each team ended, for screen readers. */
function ends(curves: readonly XpCurve[], locale: string): string {
  return curves
    .map((c) => {
      const end = c.points.at(-1);
      if (!end) return null;
      const level = end.level === null ? '' : `level ${end.level} and `;
      return `${c.name} ended at ${level}${formatStat(end.xp, INTEGER, locale)} XP`;
    })
    .filter((s) => s !== null)
    .join('; ');
}
