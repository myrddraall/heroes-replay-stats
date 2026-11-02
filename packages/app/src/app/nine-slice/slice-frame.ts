import {
  SLICE_PARTS,
  type SheetFrame,
  type SheetPartPlace,
  type SheetRect,
  type SlicePart,
  type SliceRepeat,
} from '../sheet/read-sheet';
import type { PieceCut } from '../sheet/sheet.store';
import type { SpritePicture } from '../sprite/sprite';

/** The states a frame can have pictures for; `normal` always. */
export const SLICE_STATES = ['normal', 'selected', 'focus', 'hover', 'pressed', 'disabled'] as const;
export type SliceState = (typeof SLICE_STATES)[number];

/** How a frame is drawn: the same keys whether it comes from a sheet or is given in a template. */
export interface SliceOptions {
  /** How big its corners and edges draw: 0.5 draws a 2× picture at its size in CSS pixels. Default 1. */
  readonly scale?: number;
  /** How the edges fill their length: all four alike, or each its own. Default stretch. */
  readonly edges?:
    | SliceRepeat
    | Readonly<{ top?: SliceRepeat; right?: SliceRepeat; bottom?: SliceRepeat; left?: SliceRepeat }>;
  /** How the centre fills its space. Default stretch. */
  readonly centre?: SliceRepeat;
  /** The length of one tile along a tiled edge, and of a tiled centre's tile, in CSS pixels; the picture's own length (scaled) when not set. */
  readonly tile?: number;
  /** Draws the frame in this colour (any CSS colour, `rgb(var(--hrs-glass-edge))` follows the team), its picture as the shape. */
  readonly tint?: string;
  /** Makes the right column the left one flipped (`x`), the bottom row the top one (`y`), or both. */
  readonly mirror?: 'x' | 'y' | 'xy';
  /** How far the frame reaches past the element's box, in CSS pixels (a glow, a frame that sits outside). */
  readonly outset?: number;
  /**
   * Whether the content is padded in to the frame's centre (the frame in front's, or else the one
   * behind's): on by default, `false` leaves it out, a number moves it that many pixels inward
   * (outward when negative).
   */
  readonly pad?: boolean | number;
  /** Outlines each part, to see the cuts. */
  readonly debug?: boolean;
}

/** A frame given in a template: its picture (a file, or one in a sheet), then its cuts or its parts. */
export interface SliceFrame extends SliceOptions {
  readonly picture: SpritePicture;
  /** One place in the picture's file per state, for a file holding several (instead of `picture.rect`). */
  readonly states?: Readonly<Partial<Record<SliceState, SheetRect>>>;
  /** [top, right, bottom, left], in pixels of the picture. */
  readonly cuts?: readonly [number, number, number, number];
  /** Each part's own place in the picture (a game `Border`), instead of cuts. */
  readonly parts?: Readonly<Record<SlicePart, SheetPartPlace>>;
}

/** A frame ready to draw: each state's place in a loaded picture, how it slices, and how it's drawn. */
export interface ResolvedFrame extends SliceOptions {
  readonly states: Readonly<Partial<Record<SliceState, SheetRect>>> & { readonly normal: SheetRect };
  readonly cuts?: readonly [number, number, number, number];
  readonly parts?: Readonly<Record<SlicePart, SheetPartPlace>>;
}

/** A frame from a sheet's metadata, as a ResolvedFrame (states other than the known ones are dropped). */
export function sheetFrame(frame: SheetFrame): ResolvedFrame {
  const states = Object.fromEntries(
    Object.entries(frame.states).filter(([s]) => (SLICE_STATES as readonly string[]).includes(s)),
  ) as ResolvedFrame['states'];
  if (!states.normal) throw new Error('a sheet frame without a normal state');
  return { ...(frame as SliceOptions), states, cuts: frame.cuts, parts: frame.parts };
}

/** A template's frame as a ResolvedFrame, once its picture's size is known. */
export function templateFrame(frame: SliceFrame, size: { width: number; height: number }): ResolvedFrame {
  const normal = frame.states?.normal ?? frame.picture.rect ?? [0, 0, size.width, size.height];
  return { ...frame, states: { ...frame.states, normal } };
}

/** How one part fills its cell. `corner` and `stretch` fill it; the others repeat a tile. */
export type PartFill = 'corner' | SliceRepeat;

/** One part as drawn: its piece in each state, how it fills, its tile's size and its flip. */
export interface PartPlan {
  readonly part: SlicePart;
  readonly cuts: Readonly<Partial<Record<SliceState, PieceCut>>>;
  readonly fill: PartFill;
  /** One tile's size in CSS pixels, for a repeating fill: `[width, height]`, null for the cell's own size along that side. */
  readonly tile: readonly [number | null, number | null];
  readonly flip: 'x' | 'y' | 'xy' | null;
}

/** A frame as drawn: its corner column widths and row heights (CSS pixels) and its parts. */
export interface FramePlan {
  readonly columns: readonly [number, number];
  readonly rows: readonly [number, number];
  readonly parts: readonly PartPlan[];
}

const CORNERS: readonly SlicePart[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const SIDE_OF: Partial<Record<SlicePart, 'top' | 'right' | 'bottom' | 'left'>> = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
};

type Row = 'top' | 'middle' | 'bottom';
type Column = 'left' | 'middle' | 'right';
const PART_AT: Record<Row, Record<Column, SlicePart>> = {
  top: { left: 'topLeft', middle: 'top', right: 'topRight' },
  middle: { left: 'left', middle: 'centre', right: 'right' },
  bottom: { left: 'bottomLeft', middle: 'bottom', right: 'bottomRight' },
};
const ROW_OF = (part: SlicePart): Row =>
  part.startsWith('top') ? 'top' : part.startsWith('bottom') ? 'bottom' : 'middle';
const COLUMN_OF = (part: SlicePart): Column =>
  /Left$|^left$/.test(part) ? 'left' : /Right$|^right$/.test(part) ? 'right' : 'middle';

/** The part a mirrored frame draws in place of this one, and the flip it draws it with. */
function mirrored(part: SlicePart, mirror: SliceOptions['mirror']): [SlicePart, PartPlan['flip']] {
  const fx = (mirror === 'x' || mirror === 'xy') && COLUMN_OF(part) === 'right';
  const fy = (mirror === 'y' || mirror === 'xy') && ROW_OF(part) === 'bottom';
  const source = PART_AT[fy ? 'top' : ROW_OF(part)][fx ? 'left' : COLUMN_OF(part)];
  return [source, fx && fy ? 'xy' : fx ? 'x' : fy ? 'y' : null];
}

/** Where each part is in a state's picture: from the cuts, or the parts' own places. */
function partCuts(frame: ResolvedFrame, state: SheetRect): Record<SlicePart, PieceCut> {
  const [sx, sy, sw, sh] = state;
  if (frame.parts) {
    return Object.fromEntries(
      SLICE_PARTS.map((p) => {
        const { rect, rotate } = frame.parts![p];
        const cut: PieceCut = { rect: [sx + rect[0], sy + rect[1], rect[2], rect[3]], rotate };
        return [p, cut];
      }),
    ) as Record<SlicePart, PieceCut>;
  }
  const [t, r, b, l] = frame.cuts ?? [0, 0, 0, 0];
  const mw = sw - l - r;
  const mh = sh - t - b;
  const cut = (x: number, y: number, w: number, h: number): PieceCut => ({ rect: [sx + x, sy + y, w, h] });
  return {
    topLeft: cut(0, 0, l, t),
    top: cut(l, 0, mw, t),
    topRight: cut(sw - r, 0, r, t),
    left: cut(0, t, l, mh),
    centre: cut(l, t, mw, mh),
    right: cut(sw - r, t, r, mh),
    bottomLeft: cut(0, sh - b, l, b),
    bottom: cut(l, sh - b, mw, b),
    bottomRight: cut(sw - r, sh - b, r, b),
  };
}

/** A piece's size once turned into place: `[width, height]` in the picture's pixels. */
function placedSize(cut: PieceCut): [number, number] {
  const [, , w, h] = cut.rect;
  return cut.rotate === 90 || cut.rotate === 270 ? [h, w] : [w, h];
}

/** How a frame draws: the corner cells' sizes, and each part's pieces, fill, tile and flip. */
export function planFrame(frame: ResolvedFrame): FramePlan {
  if (!frame.cuts && !frame.parts) throw new Error('a frame needs cuts or parts');
  const scale = frame.scale ?? 1;
  const byState = Object.entries(frame.states).map(
    ([state, rect]) => [state as SliceState, partCuts(frame, rect!)] as const,
  );
  const normal = partCuts(frame, frame.states.normal);
  const [mirroredRight] = mirrored('topRight', frame.mirror);
  const [mirroredBottom] = mirrored('bottomLeft', frame.mirror);
  // whole CSS pixels: parts meeting between pixels each cover the shared one partly, which shows
  // as a seam (a game frame's cuts, 40% of its size, rarely fall on whole pixels)
  const columns: [number, number] = [
    Math.round(placedSize(normal.topLeft)[0] * scale),
    Math.round(placedSize(normal[mirroredRight])[0] * scale),
  ];
  const rows: [number, number] = [
    Math.round(placedSize(normal.topLeft)[1] * scale),
    Math.round(placedSize(normal[mirroredBottom])[1] * scale),
  ];
  const edgeFill = (side: 'top' | 'right' | 'bottom' | 'left'): SliceRepeat =>
    typeof frame.edges === 'object' ? (frame.edges[side] ?? 'stretch') : (frame.edges ?? 'stretch');

  const parts = SLICE_PARTS.map((part): PartPlan => {
    const [source, flip] = mirrored(part, frame.mirror);
    const cuts = Object.fromEntries(byState.map(([state, all]) => [state, all[source]]));
    const [w, h] = placedSize(normal[source]);
    const side = SIDE_OF[part];
    const fill: PartFill = CORNERS.includes(part)
      ? 'corner'
      : part === 'centre'
        ? (frame.centre ?? 'stretch')
        : edgeFill(side!);
    const along = (length: number) => frame.tile ?? length * scale;
    const tile: PartPlan['tile'] =
      fill === 'corner' || fill === 'stretch'
        ? [null, null]
        : part === 'centre'
          ? [along(w), frame.tile ? (frame.tile * h) / w : h * scale]
          : side === 'top' || side === 'bottom'
            ? [along(w), null]
            : [null, along(h)];
    return { part, cuts, fill, tile, flip };
  });
  return { columns, rows, parts };
}
