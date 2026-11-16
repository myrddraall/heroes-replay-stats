import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type { ComposeOption } from 'echarts';
import type { Team } from '@myrddraall/heroprotocol-db';
import {
  type ActionsPerMinute,
  type ReplayPlayer,
  type StatColumn,
  type TeamColor,
  teamColor,
  type TeamColorMode,
} from '../../model';
import type { ChartLook } from '../charts/chart-look';
import {
  axisText,
  CHART_GRID,
  chartTooltip,
  escapeHtml,
  firstIndex,
  gameTimeAxis,
  INTEGER,
} from '../charts/chart-options';
import { formatStat, formatStatClock, formatStatCompact } from '../stat-tables/stat-format';

export type PlayerChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
  | AriaComponentOption
>;

/** Which player chart: one stat side by side for every player, or each player's APM over the game. */
export type PlayerChartKind = 'compare' | 'apm';

/** A player, as the charts name and colour them: your team first. */
export interface ChartPlayer {
  readonly slot: number;
  readonly name: string;
  readonly hero: string;
  /** Their team's colour from your point of view. */
  readonly color: TeamColor | null;
  /** Their own colour on a chart of every player: `--player-colour-<n>`, by place in their team. */
  readonly colour: number;
  /** Not on your team: their line is dashed. */
  readonly dashed: boolean;
}

/** How many player colours there are (`--player-colour-0` …). */
export const PLAYER_COLOURS = 5;

/** The players as the charts show them: your team first, each in slot order, with their colour. */
export function chartPlayers(
  players: readonly ReplayPlayer[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): ChartPlayer[] {
  const sorted = players
    .map((p) => ({ p, color: p.team === null ? null : teamColor(p.team, yourTeam, mode) }))
    .sort((a, b) => Number(a.color !== 'blue') - Number(b.color !== 'blue') || a.p.slot - b.p.slot);
  return sorted.map(({ p, color }) => {
    const mates = sorted.filter((s) => s.color === color);
    return {
      slot: p.slot,
      name: p.name,
      hero: p.hero,
      color,
      colour: mates.findIndex((m) => m.p.slot === p.slot) % PLAYER_COLOURS,
      dashed: color !== sorted[0]?.color,
    };
  });
}

/** What the charts show. */
export interface PlayerChartModel {
  readonly players: readonly ChartPlayer[];
  /** For `compare`: the stat, and each player's value of it by slot (null where the game had none). */
  readonly column: StatColumn | null;
  readonly values: Readonly<Record<number, number | null>>;
  /** For `apm`: each player's commands per minute, and the players hidden by slot. */
  readonly actions: readonly ActionsPerMinute[];
  readonly hidden: readonly number[];
  /** The game's length on its clock. */
  readonly durationSeconds: number;
  readonly look: ChartLook;
  readonly locale: string;
}

export function playerOptions(kind: PlayerChartKind, model: PlayerChartModel): PlayerChartOption {
  return kind === 'compare' ? compareOptions(model) : apmOptions(model);
}

const who = (p: ChartPlayer | undefined) =>
  p ? `${escapeHtml(p.hero)} (${escapeHtml(p.name)})` : '';

/** The comparison: a bar per player, your team first, in the player's team colour. */
export function compareOptions({
  players,
  column,
  values,
  look,
  locale,
}: PlayerChartModel): PlayerChartOption {
  if (!column) return {};
  const text = axisText(look);
  const format = (v: number | null) => formatStat(v, column, locale);
  return {
    animationDuration: 600,
    textStyle: { fontFamily: look.font },
    aria: {
      enabled: true,
      label: {
        description:
          `${column.label} by player: ` +
          players.map((p) => `${p.hero} (${p.name}) ${format(values[p.slot] ?? null)}`).join('; ') +
          '.',
      },
    },
    grid: CHART_GRID,
    xAxis: {
      type: 'value',
      name: column.label,
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: text,
      axisLabel: { ...text, formatter: (v: number) => formatStatCompact(v, column, locale) },
      axisLine: { show: true, lineStyle: { color: look.line } },
      splitLine: { lineStyle: { color: look.line, opacity: 0.5 } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: players.map((p) => p.hero),
      axisLabel: text,
      axisLine: { lineStyle: { color: look.line } },
      axisTick: { show: false },
    },
    tooltip: chartTooltip(
      look,
      (params) => {
        const p = players[Number((params as { dataIndex?: number }).dataIndex)];
        if (!p) return '';
        return (
          `<div class="chart-tip__row"${p.color ? ` theme="${p.color}"` : ''}><span class="chart-tip__name">${who(p)}</span><span></span>` +
          `<span class="chart-tip__value">${format(values[p.slot] ?? null)}</span></div>`
        );
      },
      'item',
    ),
    series: [
      {
        type: 'bar',
        name: column.label,
        barMaxWidth: 24,
        data: players.map((p) => ({
          value: values[p.slot] ?? 0,
          itemStyle: {
            color: p.color ? look.teams[p.color] : look.label,
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          color: look.label,
          fontFamily: look.font,
          formatter: (p: { dataIndex: number }) =>
            format(values[players[p.dataIndex]!.slot] ?? null),
        },
      },
    ],
  };
}

/** The APM: a line per player in their team's colour, a point every minute of the game. */
export function apmOptions({
  players: all,
  actions,
  hidden,
  durationSeconds,
  look,
  locale,
}: PlayerChartModel): PlayerChartOption {
  const players = all.filter((p) => !hidden.includes(p.slot));
  const colour = (p: ChartPlayer) => look.extra[`player-colour-${p.colour}`] ?? look.label;
  const text = axisText(look);
  // a last part-minute of under half a minute (the game ending) is too short to show a rate
  const whole = Math.floor(durationSeconds / 60);
  const minutes = Math.max(1, whole + (durationSeconds - whole * 60 >= 30 ? 1 : 0));
  /** The player's APM each minute: a partial last minute counts at its rate. */
  const line = (slot: number) =>
    Array.from({ length: minutes }, (_, minute) => {
      const length = Math.min(60, durationSeconds - minute * 60);
      const n = actions.find((a) => a.slot === slot && a.minute === minute)?.actions ?? 0;
      return [minute * 60 + Math.max(0, length) / 2, length > 0 ? (n * 60) / length : 0];
    });
  const lines = players.map((p) => line(p.slot));
  const average = (i: number) => {
    const total = actions
      .filter((a) => a.slot === players[i]!.slot)
      .reduce((s, a) => s + a.actions, 0);
    return durationSeconds > 0 ? (total * 60) / durationSeconds : 0;
  };
  return {
    animationDuration: 600,
    textStyle: { fontFamily: look.font },
    aria: {
      enabled: true,
      label: {
        description:
          "Each player's actions per minute over the game; on average " +
          players.map((p, i) => `${p.hero} ${formatStat(average(i), INTEGER, locale)}`).join(', ') +
          '.',
      },
    },
    // room for the heroes' names at the lines' ends
    grid: { ...CHART_GRID, right: 96 },
    xAxis: gameTimeAxis(durationSeconds, look),
    yAxis: {
      type: 'value',
      min: 0,
      name: 'Actions per minute',
      nameTextStyle: text,
      axisLabel: { ...text, formatter: (v: number) => formatStatCompact(v, INTEGER, locale) },
      axisLine: { show: true, lineStyle: { color: look.line } },
      splitLine: { lineStyle: { color: look.line, opacity: 0.5 } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
    ],
    tooltip: chartTooltip(look, (params) => {
      const index = firstIndex(params);
      if (index === null) return '';
      const minute = index;
      const rows = players
        .map((p, i) => ({ p, apm: lines[i]![index]?.[1] ?? 0 }))
        .map(
          ({ p, apm }) =>
            `<div class="chart-tip__row"><span><span class="chart-tip__swatch" style="background:${colour(p)}"></span>` +
            `<span${p.color ? ` theme="${p.color}"` : ''} class="chart-tip__name">${who(p)}</span></span><span></span>` +
            `<span class="chart-tip__value">${formatStat(apm, INTEGER, locale)}</span></div>`,
        )
        .join('');
      return `<div class="chart-tip__time">${formatStatClock(minute * 60)} – ${formatStatClock(Math.min(durationSeconds, minute * 60 + 60))}</div>${rows}`;
    }),
    series: players.map((p, i): LineSeriesOption => ({
      type: 'line',
      name: `${p.hero} (${p.name})`,
      data: lines[i],
      showSymbol: false,
      lineStyle: { width: 2, color: colour(p), type: p.dashed ? 'dashed' : 'solid' },
      itemStyle: { color: colour(p) },
      // the hero at the line's end, so the colours never have to carry it alone
      endLabel: { show: true, formatter: p.hero, color: colour(p), fontFamily: look.font },
      labelLayout: { moveOverlap: 'shiftY' },
      emphasis: { focus: 'series', lineStyle: { width: 3 } },
    })),
  };
}
