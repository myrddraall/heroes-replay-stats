import { InjectionToken } from '@angular/core';

/**
 * Lists draw every row, unmeasured, each the estimated height: where there is no layout to
 * measure (tests). Off by default; `provideWholeLists()` (testing) turns it on.
 */
export const WHOLE_LISTS = new InjectionToken<boolean>('WHOLE_LISTS', { factory: () => false });
