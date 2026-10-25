import { InjectionToken } from '@angular/core';

/**
 * What shows the level that wins over a setting (by the name a row's override gives it), where an
 * editor provides it: a row marked overridden then takes you there when its mark is pressed.
 */
export const OVERRIDE_SHOWN = new InjectionToken<(level: string) => void>('the overriding level shown');
