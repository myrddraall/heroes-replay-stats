import {
  newTint,
  type TintKind,
  type TintLayer,
  type TintsSet,
} from '@myrddraall/heroes-replay-stats-aether/tints';

/**
 * An object's tints as its Colour section lists them: those added under the level edited first
 * (each with where it was added), in layer order, then the level's own; each drawn or not as the
 * level edited and those under it say.
 */
export interface TintRow {
  readonly tint: TintLayer;
  /** Where it was added, where that is a level under the one edited (none: the level's own). */
  readonly from?: string;
  /** Whether it is drawn. */
  readonly on: boolean;
  /** Whether it is drawn as the levels under the one edited say (the level's own: drawn). */
  readonly onBelow: boolean;
  /** Whether the level edited switches it on or off (one added under it: a reset gives back theirs). */
  readonly switched: boolean;
}

/** A level an object is set at, by name (`the library (planet)`, `its tuning`), and its tints there. */
export type TintLevel = readonly [name: string, set: TintsSet | undefined];

/**
 * An object's tints as listed (`TintRow`): those of the levels under the one edited (`below`, the
 * lowest first), then those of the level edited (`edited`).
 */
export function tintRowsOf(below: readonly TintLevel[], edited: TintsSet | undefined): TintRow[] {
  const switchBelow = (id: string) =>
    [...below].reverse().find(([, s]) => s?.tintsEnabled?.[id] !== undefined)?.[1]?.tintsEnabled?.[
      id
    ];
  const row = (tint: TintLayer, from?: string): TintRow => {
    const here = edited?.tintsEnabled?.[tint.id];
    const onBelow = from === undefined || switchBelow(tint.id) !== false;
    return {
      tint,
      ...(from !== undefined ? { from } : {}),
      on: here ?? onBelow,
      onBelow,
      switched: from !== undefined && here !== undefined,
    };
  };
  return [
    ...below.flatMap(([name, s]) => (s?.tints ?? []).map((t) => row(t, name))),
    ...(edited?.tints ?? []).map((t) => row(t)),
  ];
}

/** An edit of an object's tints at the level edited, as the Colour section makes it. */
export type TintEdit =
  | { readonly kind: 'add'; readonly tint: TintKind; readonly theme?: string }
  | { readonly kind: 'change'; readonly tint: TintLayer }
  | { readonly kind: 'remove'; readonly id: string }
  | { readonly kind: 'move'; readonly id: string; readonly to: number }
  | { readonly kind: 'switch'; readonly id: string; readonly on: boolean }
  | { readonly kind: 'reset-switch'; readonly id: string };

/**
 * The level edited's tints with an edit made (`rows`: the object's as listed, for the ids taken and
 * what a switch would be without the level's say): one added after its own (an id not taken at any
 * level), changed or taken out (its switch with it), moved among its own (`to`: its place among
 * them), or switched on or off (one added under it: a switch back to what is under it says nothing,
 * so it is taken back). Nothing left: none (so the level sets no tints).
 */
export function editedTints(
  set: TintsSet | undefined,
  rows: readonly TintRow[],
  edit: TintEdit,
): TintsSet | undefined {
  const own = set?.tints ?? [];
  let tints = own;
  let switches: Record<string, boolean> = { ...set?.tintsEnabled };
  switch (edit.kind) {
    case 'add':
      tints = [...own, newTint(edit.tint, rows.map((r) => r.tint.id), edit.theme)];
      break;
    case 'change':
      tints = own.map((t) => (t.id === edit.tint.id ? edit.tint : t));
      break;
    case 'remove': {
      tints = own.filter((t) => t.id !== edit.id);
      switches = unswitched(switches, edit.id);
      break;
    }
    case 'move': {
      const moved = own.find((t) => t.id === edit.id);
      if (!moved) return set;
      const rest = own.filter((t) => t.id !== edit.id);
      const to = Math.max(0, Math.min(rest.length, edit.to));
      tints = [...rest.slice(0, to), moved, ...rest.slice(to)];
      break;
    }
    case 'switch': {
      // (Switched to what is under it, the level's own on: the level says nothing of it.)
      const onBelow = rows.find((r) => r.tint.id === edit.id)?.onBelow ?? true;
      switches =
        edit.on === onBelow ? unswitched(switches, edit.id) : { ...switches, [edit.id]: edit.on };
      break;
    }
    case 'reset-switch':
      switches = unswitched(switches, edit.id);
      break;
  }
  const out: TintsSet = {
    ...(tints.length ? { tints } : {}),
    ...(Object.keys(switches).length ? { tintsEnabled: switches } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** Switches without one tint's. */
const unswitched = (switches: Readonly<Record<string, boolean>>, id: string) =>
  Object.fromEntries(Object.entries(switches).filter(([k]) => k !== id));

/** A tint's kind as people read it. */
export const TINT_KIND_LABELS: Readonly<Record<TintKind, string>> = {
  colour: 'Colour fill',
  hsl: 'Hue & saturation',
  gradient: 'Gradient map',
  'white-balance': 'White balance',
  'brightness-contrast': 'Brightness & contrast',
  'lift-gamma-gain': 'Lift, gamma & gain',
  levels: 'Levels',
  theme: 'Theme colour',
};

/** Each kind's icon (Material Symbols). */
export const TINT_KIND_ICONS: Readonly<Record<TintKind, string>> = {
  colour: 'format_color_fill',
  hsl: 'tune',
  gradient: 'gradient',
  'white-balance': 'wb_auto',
  'brightness-contrast': 'contrast',
  'lift-gamma-gain': 'tonality',
  levels: 'equalizer',
  theme: 'format_paint',
};

/** A tint's name as listed: its own, else its kind's. */
export const tintLabel = (t: TintLayer) => t.name || TINT_KIND_LABELS[t.kind];

/**
 * A level's tints as they are to be set, as a change of its settings: what to set (none: nothing)
 * and what to take back (each of its list and its switches it no longer has).
 */
export function tintChanges(set: TintsSet | undefined): {
  readonly set: TintsSet | null;
  readonly clear: readonly (keyof TintsSet)[];
} {
  const keys = ['tints', 'tintsEnabled'] as const;
  const kept = keys.filter((k) => set?.[k] !== undefined);
  return {
    set: kept.length ? (Object.fromEntries(kept.map((k) => [k, set![k]])) as TintsSet) : null,
    clear: keys.filter((k) => set?.[k] === undefined),
  };
}
