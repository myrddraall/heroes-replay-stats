import type { Provider } from '@angular/core';
import { WHOLE_LISTS } from '../model';

/** Lists draw every row, for tests (no layout to measure, nothing scrolls): add to TestBed's providers. */
export function provideWholeLists(): Provider {
  return { provide: WHOLE_LISTS, useValue: true };
}
