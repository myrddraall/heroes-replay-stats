import type { Provider } from '@angular/core';
import { SHEET_PICTURES, type SheetPictures } from '../model';

/** For tests: sheets that never load, so a file shows as it is and a sheet's picture by name never does. */
export const fakeSheetPictures: SheetPictures = {
  sheetUrl: (sheet) => `/sheets/${sheet}.webp`,
  load: () => undefined,
  status: () => undefined,
  piece: () => Promise.reject(new Error('not used')),
};

/** For tests: `SHEET_PICTURES` bound to `fakeSheetPictures`. */
export function provideFakeSheets(): Provider {
  return { provide: SHEET_PICTURES, useValue: fakeSheetPictures };
}
