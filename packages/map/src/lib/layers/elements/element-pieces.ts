import type { Cell, ElementCut, HiddenByMask, PackElements } from '../../pack/map-pack';

/** What a structure shows: as it stands, its rubble, or nothing. */
export type StructureShown = 'standing' | 'rubble' | 'off';
/** What a camp shows: its defenders, or nothing. */
export type CampShown = 'spawned' | 'off';
export type ElementKind = 'structure' | 'camp';
export type ElementShown = StructureShown | CampShown;

/** Each kind's states, in the order a click steps through them. */
export const KIND_STATES = {
  structure: ['standing', 'rubble', 'off'],
  camp: ['spawned', 'off'],
} as const satisfies Record<ElementKind, readonly ElementShown[]>;

/** A structure or camp of the pack, as the elements layer draws it. */
export interface ElementPiece {
  /** Unique in the pack: `structure-<id>`, `camp-<camp>`. */
  readonly key: string;
  readonly kind: ElementKind;
  /** A structure's id (what `hiddenBy` names); `null` for a camp. */
  readonly id: number | null;
  readonly cell: Cell;
  readonly states: Readonly<Partial<Record<string, ElementCut | null>>>;
  /**
   * What the pointer finds it by, whatever it shows: its first state's picture (a structure
   * standing, a camp spawned), where that picture isn't see-through. A rubble's circle reaches far
   * wider than the structure.
   */
  readonly hit: ElementCut | null;
}

/** The pack's structures and camps, further north first: the drawing order. */
export function piecesOf(elements: PackElements): ElementPiece[] {
  const pieces: ElementPiece[] = [
    ...elements.structures.map((s) =>
      piece('structure', `structure-${s.id}`, s.id, s.cell, s.states),
    ),
    ...elements.camps.map((c) => piece('camp', `camp-${c.camp}`, null, c.cell, c.states)),
  ];
  return pieces.sort((a, b) => b.cell[1] - a.cell[1]);
}

function piece(
  kind: ElementKind,
  key: string,
  id: number | null,
  cell: Cell,
  states: Readonly<Partial<Record<string, ElementCut | null>>>,
): ElementPiece {
  const first = states[KIND_STATES[kind][0]];
  const hit = first ?? Object.values(states).find((cut): cut is ElementCut => Boolean(cut)) ?? null;
  return { key, kind, id, cell, states, hit };
}

/** The states of a kind. */
export type KindShown<K extends ElementKind> = (typeof KIND_STATES)[K][number];

/** The state after this one, in a kind's order (back to the first after the last). */
export function nextState<K extends ElementKind>(kind: K, current: KindShown<K>): KindShown<K> {
  const states: readonly KindShown<K>[] = KIND_STATES[kind];
  return states[(states.indexOf(current) + 1) % states.length] ?? current;
}

/**
 * The masks to erase from a standing structure's cut-out: those of the neighbours that are
 * standing too (PACK.md, Elements: hiddenBy).
 */
export function standingMasks(
  cut: ElementCut,
  isStanding: (id: number) => boolean,
): HiddenByMask[] {
  return (cut.hiddenBy ?? []).filter((mask) => isStanding(mask.id));
}

/** A picture's size and transparency (one byte a pixel), for finding what the pointer is over. */
export interface HitImage {
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

/** A pixel at least this opaque is the element's. */
export const HIT_ALPHA = 48;

/**
 * The piece at a pixel of the map layer: the nearest drawn first (the last), found by its hit
 * picture's opaque pixels. Pieces whose hit picture isn't loaded yet aren't found.
 */
export function pieceAt(
  pieces: readonly ElementPiece[],
  px: number,
  py: number,
  hitImage: (cut: ElementCut) => HitImage | undefined,
): ElementPiece | null {
  for (let k = pieces.length - 1; k >= 0; k--) {
    const piece = pieces[k];
    const cut = piece?.hit;
    const image = cut && hitImage(cut);
    if (!piece || !cut || !image) continue;
    const [x, y, w, h] = cut.rect;
    const ix = Math.floor(((px - x) * image.width) / w);
    const iy = Math.floor(((py - y) * image.height) / h);
    if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) continue;
    if ((image.alpha[iy * image.width + ix] ?? 0) >= HIT_ALPHA) return piece;
  }
  return null;
}
