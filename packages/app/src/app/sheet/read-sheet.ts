/** Where a picture sits in its sheet: `[x, y, width, height]` in pixels. */
export type SheetRect = readonly [number, number, number, number];

/** A 9-slice's parts, in reading order. */
export const SLICE_PARTS = [
  'topLeft',
  'top',
  'topRight',
  'left',
  'centre',
  'right',
  'bottomLeft',
  'bottom',
  'bottomRight',
] as const;
export type SlicePart = (typeof SLICE_PARTS)[number];

/** How a stretchable part fills its space: stretched, tiled, tiled in whole tiles scaled to fit, or whole tiles spaced out. */
export type SliceRepeat = 'stretch' | 'tile' | 'round' | 'space';

/** Where a part sits in its frame's picture, and how far it turns (clockwise) to go in place. */
export interface SheetPartPlace {
  readonly rect: SheetRect;
  readonly rotate?: 90 | 180 | 270;
}

/**
 * A frame in a sheet: each state's place in the sheet (`normal` always), then how it slices: four
 * cuts as [top, right, bottom, left] in pixels of a state's picture, or each part's own place in
 * it. The rest says how pages draw it (any `SliceFrame` option, see the 9-slice directive).
 */
export interface SheetFrame {
  readonly states: Readonly<Record<string, SheetRect>>;
  readonly cuts?: readonly [number, number, number, number];
  readonly parts?: Readonly<Record<SlicePart, SheetPartPlace>>;
  readonly [option: string]: unknown;
}

/** What a sheet keeps inside its file (heroes-assets' lib/ui-sheets.ts writes it). */
export interface SheetMeta {
  readonly v: 1;
  readonly frames: Readonly<Record<string, SheetFrame>>;
  /** Named pairs: a frame drawn behind a page's content, one in front, or both. */
  readonly sets: Readonly<Record<string, { readonly back?: string; readonly front?: string }>>;
  /** Single pictures, for sprites. */
  readonly pictures?: Readonly<Record<string, SheetRect>>;
}

/** The chunk heroes-assets keeps a sheet's metadata in: deflate-raw JSON, right after the header. */
const META_CHUNK = 'HRSM';

const fourCc = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);

/**
 * A sheet's picture and metadata from its file's bytes: the WebP as it is (a browser skips the
 * metadata chunk) and the metadata unpacked. Fails for a file that isn't a WebP, has no metadata
 * or has a version this app doesn't read.
 */
export async function readSheet(bytes: ArrayBuffer): Promise<{ meta: SheetMeta; image: Blob }> {
  const data = new Uint8Array(bytes);
  const view = new DataView(bytes);
  if (fourCc(data, 0) !== 'RIFF' || fourCc(data, 8) !== 'WEBP') throw new Error('not a WebP file');
  for (let at = 12; at + 8 <= data.length; ) {
    const size = view.getUint32(at + 4, true);
    if (fourCc(data, at) === META_CHUNK) {
      const packed = new Response(data.slice(at + 8, at + 8 + size)).body!;
      const text = await new Response(
        packed.pipeThrough(new DecompressionStream('deflate-raw')),
      ).text();
      const meta = JSON.parse(text) as SheetMeta;
      if (meta.v !== 1) throw new Error(`a sheet's metadata version ${String(meta.v)}, not 1`);
      return { meta, image: new Blob([bytes], { type: 'image/webp' }) };
    }
    at += 8 + size + (size & 1);
  }
  throw new Error('the sheet has no metadata');
}
