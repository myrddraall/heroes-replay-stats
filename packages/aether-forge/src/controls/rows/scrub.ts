/**
 * A number scrubbed by dragging up or down from where it was pressed: how far the pointer is from
 * there sets how fast the number changes (not where it is), so a number with wide limits, or
 * none, is set as finely or as fast as wanted without a slider's length bounding it.
 */

/** How far (CSS pixels) the pointer may wander from where it was pressed before the number moves. */
export const SCRUB_DEAD_ZONE = 4;
/** How far past the dead zone one step a second is; twice as far, four times as fast. */
const SCRUB_SCALE = 10;

/**
 * How fast a scrubbed number changes, in its units a second, with the pointer `offset` pixels up
 * from where it was pressed (down: negative, the number going down).
 */
export function scrubRate(offset: number, step: number): number {
  const past = Math.abs(offset) - SCRUB_DEAD_ZONE;
  if (past <= 0) return 0;
  return Math.sign(offset) * (past / SCRUB_SCALE) ** 2 * step;
}

/**
 * How many steps a key press or wheel notch moves a number: 1; with Shift 10; with Alt (Option)
 * 100. Not Ctrl: Ctrl and the wheel just off the field zooms the page.
 */
export function stepsFor(keys: { readonly shiftKey: boolean; readonly altKey: boolean }): number {
  return keys.altKey ? 100 : keys.shiftKey ? 10 : 1;
}

/** How far (CSS pixels) a wheel turns a number one notch: a mouse's notch, or a trackpad's swipe so far. */
export const WHEEL_NOTCH = 100;

/** A wheel event's distance in CSS pixels, whichever unit it gives (lines, pages) and axis (Shift turns some). */
export function wheelPixels(event: {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
}): number {
  const delta = event.deltaY || event.deltaX;
  return delta * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 800 : 1);
}

/** A number within its limits (either may be unset: none that way). */
export function clamped(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

/** How many decimals a step has (0.05: 2). */
export function decimalsOf(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1]!.length : 0;
}

/** A number to its step (and its decimals, without float noise), within its limits. */
export function stepped(value: number, step: number, min?: number, max?: number): number {
  const rounded = Number((Math.round(value / step) * step).toFixed(decimalsOf(step)));
  return clamped(rounded, min, max);
}

/** A number's limits as shown beside it: "0 – 1", "≥ 0", "≤ 1", or "Any" where it has none. */
export function limitsText(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${min} – ${max}`;
  if (min !== undefined) return `≥ ${min}`;
  if (max !== undefined) return `≤ ${max}`;
  return 'Any';
}
