import type { TooltipComponentOption } from 'echarts/components';
import type { XAXisComponentOption } from 'echarts';
import { formatStatClock } from '../stat-tables/stat-format';
import type { ChartLook } from './chart-look';

/** Whole numbers, for `formatStat`. */
export const INTEGER = { format: 'integer' } as const;

/** Axis label and name text in the chart's look. */
export interface AxisText {
  color: string;
  fontFamily: string;
}

export function axisText(look: ChartLook): AxisText {
  return { color: look.label, fontFamily: look.font };
}

/** The plot area, keeping every label and axis name inside the chart. */
export const CHART_GRID = {
  left: 16,
  right: 16,
  top: 40,
  bottom: 16,
  outerBoundsMode: 'same',
  outerBoundsContain: 'all',
} as const;

/**
 * The game's clock along the bottom, up to `end` seconds: a tick every whole minute, zoomed or not,
 * labelled every 1, 2, 5 or 10 minutes (evenly, at most about 16 along the game).
 */
export function gameTimeAxis(end: number, look: ChartLook): XAXisComponentOption {
  const text = axisText(look);
  const minutes = Array.from({ length: Math.floor(end / 60) + 1 }, (_, i) => i * 60);
  const step = [1, 2, 5, 10].find((m) => end / 60 / m <= 16) ?? 10;
  const labelled = minutes.filter((s) => (s / 60) % step === 0);
  return {
    type: 'value',
    min: 0,
    max: end,
    name: 'Time',
    nameLocation: 'middle',
    nameGap: 28,
    nameTextStyle: text,
    axisLabel: {
      ...text,
      hideOverlap: true,
      customValues: labelled,
      formatter: (v: number) => formatStatClock(v),
    },
    axisTick: { customValues: minutes },
    // along the bottom, not through a value axis's 0
    axisLine: { onZero: false, lineStyle: { color: look.line } },
    splitLine: { show: false },
  };
}

/**
 * A tooltip as a raised panel: its background and its content's layout come from the stylesheet
 * (`chart-tooltip` in `_chart-tooltip.scss`), which every chart component includes.
 */
export function chartTooltip(
  look: ChartLook,
  formatter: (params: unknown) => string,
  trigger: 'axis' | 'item' = 'axis',
): TooltipComponentOption {
  return {
    trigger,
    formatter,
    confine: true,
    className: 'hrs-panel hrs-panel--raised chart-tip',
    borderColor: look.line,
    borderWidth: 1,
    padding: [8, 12],
    axisPointer: { type: 'line', lineStyle: { color: look.label } },
  };
}

/** The hovered point's index, from an axis tooltip's params. */
export function firstIndex(params: unknown): number | null {
  const first: unknown = Array.isArray(params) ? params[0] : params;
  if (typeof first !== 'object' || first === null || !('dataIndex' in first)) return null;
  return typeof first.dataIndex === 'number' ? first.dataIndex : null;
}

/** The smallest round number (1, 2 or 5 times a power of ten, in steps of a tenth) at or above. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value)) / 10;
  return Math.ceil(value / step) * step;
}

/** Text for the tooltip's HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
