import type { Provider } from '@angular/core';
import { SheetStore, SHEETS_BASE_URL } from '../data';
import { SHEET_PICTURES } from '../model';

export interface SheetsOptions {
  /** Where named sheets are: `validation` is `<url>validation.webp`. */
  readonly url: string;
}

/** The interface sheets in an app: where they are, and the store sprites and 9-slice frames load them through. */
export function provideSheets({ url }: SheetsOptions): Provider[] {
  return [
    { provide: SHEETS_BASE_URL, useValue: url },
    { provide: SHEET_PICTURES, useExisting: SheetStore },
  ];
}
