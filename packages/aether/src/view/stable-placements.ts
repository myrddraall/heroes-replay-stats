import type { PlanetPlacement } from '../space/space';

/**
 * Whether two values are the same data: numbers, strings and the like alike, arrays and plain
 * objects alike throughout (keys left out and keys set to undefined alike); anything else (a
 * loaded planet, an image) only if it is the same one.
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => sameData(v, b[i]));
  }
  if (
    Object.getPrototypeOf(a) !== Object.prototype ||
    Object.getPrototypeOf(b) !== Object.prototype
  )
    return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)]))
    if (!sameData(x[k], y[k])) return false;
  return true;
}

/**
 * Whether two placements put up the same: the same planet and overlays (loaded: the same ones),
 * everything else the same data.
 */
export function samePlacement(a: PlanetPlacement, b: PlanetPlacement): boolean {
  if (a === b) return true;
  if (a.planet !== b.planet) return false;
  const ao = a.overlays ?? [];
  const bo = b.overlays ?? [];
  if (ao.length !== bo.length || ao.some((o, i) => o !== bo[i])) return false;
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)]))
    if (k !== 'planet' && k !== 'overlays' && !sameData(x[k], y[k])) return false;
  return true;
}

/**
 * Placements made again, each the one before where it puts up the same (by place in the list), the
 * list itself the one before where all of them are: what is drawn of a body then changes only
 * when the body does (an edit of one body leaves the others as they were drawn).
 */
export function keepUnchanged(
  before: readonly PlanetPlacement[] | null | undefined,
  next: readonly PlanetPlacement[],
): readonly PlanetPlacement[] {
  if (!before) return next;
  const kept = next.map((p, i) => {
    const old = before[i];
    return old && samePlacement(old, p) ? old : p;
  });
  return kept.length === before.length && kept.every((p, i) => p === before[i]) ? before : kept;
}
