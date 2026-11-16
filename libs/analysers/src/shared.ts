import type { AnalyserContext, PlayerRecord, StatEventRecord } from '@myrddraall/heroprotocol-db';

/**
 * Analyser ids keep the `@myrddraall/` namespace they had as heroprotocol built-ins, so
 * runs already stored under those ids stay valid.
 */
export const NS = '@myrddraall/';

/** Human players and AI, in slot order — observers are not part of the game. */
export async function participants(ctx: AnalyserContext): Promise<PlayerRecord[]> {
  return (await ctx.read('players'))
    .filter((p) => p.kind !== 'observer')
    .sort((a, b) => a.slot - b.slot);
}

export async function statEvents(
  ctx: AnalyserContext,
  eventName: string,
): Promise<StatEventRecord[]> {
  return [...(await ctx.read('statEvents', { eventName }))].sort((a, b) => a.gameloop - b.gameloop);
}

export function int(e: StatEventRecord, key: string): number | null {
  const v = e.values[key];
  return typeof v === 'number' ? v : null;
}

export function str(e: StatEventRecord, key: string): string | null {
  const v = e.values[key];
  return typeof v === 'string' ? v : null;
}

/** A repeated key (`lists`) or a single value, always as an array. */
export function all(e: StatEventRecord, key: string): (number | string)[] {
  const list = e.lists?.[key];
  if (list) return [...list];
  const v = e.values[key];
  return v === undefined ? [] : [v];
}

/** Number rows 0..n-1 so `[replayId+seq]` keys them in order. */
export function withSeq<T extends object>(rows: readonly T[]): (T & { seq: number })[] {
  return rows.map((row, seq) => ({ ...row, seq }));
}
