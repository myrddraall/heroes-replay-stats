import { InjectionToken } from '@angular/core';
import type { SheetMeta, SheetRect } from './sheet-meta';

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

/** How a piece is cut: its place in the picture, and how far it turns (clockwise) first. */
export interface PieceCut {
  readonly rect: SheetRect;
  readonly rotate?: 0 | 90 | 180 | 270;
}

/**
 * The pictures sprites and 9-slice frames draw from, each loaded once and shared: what they ask of
 * the store that loads them (`SheetStore`, bound by `provideSheets`).
 */
export interface SheetPictures {
  /** A named sheet's URL. */
  sheetUrl(sheet: string): string;
  /** Starts loading a picture (a sheet or a plain file) unless it is loaded or loading. */
  load(url: string): void;
  /** How a picture's load stands (read in a `computed` or effect to follow it). */
  status(url: string): PictureStatus | undefined;
  /** A piece of a loaded picture as a blob URL, cut (and turned) once and reused. */
  piece(url: string, cut: PieceCut): Promise<string>;
}

export const SHEET_PICTURES = new InjectionToken<SheetPictures>('SHEET_PICTURES');
