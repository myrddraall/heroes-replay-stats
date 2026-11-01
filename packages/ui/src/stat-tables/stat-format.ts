import type { StatColumn } from './stat-column';

/** What a cell shows for a stat with no value. */
export const NO_STAT_VALUE = '–';

const DEFAULT_DIGITS = {
  integer: [0, 0],
  decimal: [2, 2],
  percent: [2, 2],
} as const;

const formats = new Map<string, Intl.NumberFormat>();

function numberFormat(
  locale: string,
  style: 'decimal' | 'percent',
  [min, max]: readonly [number, number],
): Intl.NumberFormat {
  const key = `${locale}|${style}|${min}|${max}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style,
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    formats.set(key, format);
  }
  return format;
}

/** Seconds as `1m 05s`, `42s` or `0s`. */
export function formatStatDuration(seconds: number, locale: string): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes === 0) return `${rest}s`;
  return `${numberFormat(locale, 'decimal', [0, 0]).format(minutes)}m ${String(rest).padStart(2, '0')}s`;
}

/** A stat's value as its column shows it; {@link NO_STAT_VALUE} for none. */
export function formatStat(
  value: number | null | undefined,
  column: Pick<StatColumn, 'format' | 'digits'>,
  locale: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_STAT_VALUE;
  if (column.format === 'duration') return formatStatDuration(value, locale);
  const style = column.format === 'percent' ? 'percent' : 'decimal';
  return numberFormat(locale, style, column.digits ?? DEFAULT_DIGITS[column.format]).format(value);
}
