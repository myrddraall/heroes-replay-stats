import type { StatColumn } from '../../model';

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

/** Seconds on a clock as `m:ss`, `h:mm:ss` past an hour, with a minus before zero. */
export function formatStatClock(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 0) return `-${formatStatClock(-whole)}`;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const ss = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * A stat's value in short form for tight spaces: a count or number of 1,000 and up as `89.3K` (in
 * the locale's form), anything else as {@link formatStat} has it.
 */
export function formatStatCompact(
  value: number | null | undefined,
  column: Pick<StatColumn, 'format' | 'digits'>,
  locale: string,
): string {
  const short = column.format === 'integer' || column.format === 'decimal';
  if (!short || value === null || value === undefined || !(Math.abs(value) >= 1_000)) {
    return formatStat(value, column, locale);
  }
  const key = `${locale}|compact`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    formats.set(key, format);
  }
  return format.format(value);
}

/** A stat's value as its column shows it; {@link NO_STAT_VALUE} for none. */
export function formatStat(
  value: number | null | undefined,
  column: Pick<StatColumn, 'format' | 'digits'>,
  locale: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_STAT_VALUE;
  if (column.format === 'duration') return formatStatDuration(value, locale);
  if (column.format === 'clock') return formatStatClock(value);
  const style = column.format === 'percent' ? 'percent' : 'decimal';
  return numberFormat(locale, style, column.digits ?? DEFAULT_DIGITS[column.format]).format(value);
}
