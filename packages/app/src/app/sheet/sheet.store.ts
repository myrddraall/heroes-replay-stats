import { inject, InjectionToken } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { environment } from '../../environments/environment';
import { readSheet, type SheetMeta, type SheetRect } from './read-sheet';

/**
 * Where named sheets are (`validation` is `<url>validation.webp`): heroes-assets' published
 * interface sheets, or this machine's under the `local` configuration. A subtree can give its own.
 */
export const SHEETS_BASE_URL = new InjectionToken<string>('hrs.sheets-base-url', {
  providedIn: 'root',
  factory: () => environment.uiSheetsUrl,
});

/** A picture loaded: its blob's URL and size, and the metadata a sheet keeps inside it. */
export interface LoadedPicture {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly meta: SheetMeta | null;
}

export type PictureStatus =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly picture: LoadedPicture }
  | { readonly status: 'error'; readonly error: string };

/** A name like `validation#panel`: the sheet and the entry in it. */
export function parseSheetName(name: string): { sheet: string; entry: string } {
  const at = name.indexOf('#');
  if (at <= 0 || at === name.length - 1) throw new Error(`"${name}" isn't <sheet>#<name>`);
  return { sheet: name.slice(0, at), entry: name.slice(at + 1) };
}

/** How a piece is cut: its place in the picture, and how far it turns (clockwise) first. */
export interface PieceCut {
  readonly rect: SheetRect;
  readonly rotate?: 0 | 90 | 180 | 270;
}

/**
 * The pictures pages draw from, each fetched once and shared: sheets (with their metadata, one
 * request for both) and plain files. And pieces cut out of them (a 9-slice's parts), each made
 * once on a canvas and kept as a blob URL for CSS.
 */
export const SheetStore = signalStore(
  { providedIn: 'root' },
  withState<{ pictures: Record<string, PictureStatus> }>({ pictures: {} }),
  withMethods((store) => {
    const base = inject(SHEETS_BASE_URL);
    const bitmaps = new Map<string, ImageBitmap>();
    const pieces = new Map<string, Promise<string>>();

    const set = (url: string, status: PictureStatus) =>
      patchState(store, (s) => ({ pictures: { ...s.pictures, [url]: status } }));

    return {
      /** A named sheet's URL. */
      sheetUrl(sheet: string): string {
        return `${base}${sheet}.webp`;
      },

      /** Starts loading a picture (a sheet or a plain file) unless it is loaded or loading. */
      load(url: string): void {
        if (store.pictures()[url]) return;
        set(url, { status: 'loading' });
        (async () => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          const bytes = await response.arrayBuffer();
          const sheet = await readSheet(bytes).catch(() => null);
          const blob = sheet?.image ?? new Blob([bytes], { type: response.headers.get('content-type') ?? '' });
          const bitmap = await createImageBitmap(blob);
          bitmaps.set(url, bitmap);
          set(url, {
            status: 'ready',
            picture: {
              url: URL.createObjectURL(blob),
              width: bitmap.width,
              height: bitmap.height,
              meta: sheet?.meta ?? null,
            },
          });
        })().catch((error: unknown) => set(url, { status: 'error', error: String(error) }));
      },

      /** How a picture's load stands (read in a `computed` or effect to follow it). */
      status(url: string): PictureStatus | undefined {
        return store.pictures()[url];
      },

      /** A piece of a loaded picture as a blob URL, cut (and turned) once and reused. */
      piece(url: string, cut: PieceCut): Promise<string> {
        const rotate = cut.rotate ?? 0;
        const key = `${url}|${cut.rect.join(',')}|${rotate}`;
        let piece = pieces.get(key);
        if (!piece) {
          piece = (async () => {
            const bitmap = bitmaps.get(url);
            if (!bitmap) throw new Error(`${url} isn't loaded`);
            // cuts can fall between pixels (a game frame's are 40% of its size): the piece is the
            // nearest whole size, the cut stretched to fill it
            const [x, y, w, h] = cut.rect;
            const turned = rotate === 90 || rotate === 270;
            const width = Math.max(1, Math.round(turned ? h : w));
            const height = Math.max(1, Math.round(turned ? w : h));
            const canvas = new OffscreenCanvas(width, height);
            const context = canvas.getContext('2d')!;
            context.translate(width / 2, height / 2);
            context.rotate((rotate * Math.PI) / 180);
            const [dw, dh] = turned ? [height, width] : [width, height];
            context.drawImage(bitmap, x, y, w, h, -dw / 2, -dh / 2, dw, dh);
            return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
          })();
          pieces.set(key, piece);
        }
        return piece;
      },
    };
  }),
);
