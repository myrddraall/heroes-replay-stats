import { InjectionToken, type Provider } from '@angular/core';
import { DEFAULT_LAYOUT_CONSTRAINTS, type LayoutConstraints } from '../../model';

/** The constraints the layouts apply; the defaults unless provided (`provideLayoutConstraints`). */
export const LAYOUT_CONSTRAINTS = new InjectionToken<LayoutConstraints>('LAYOUT_CONSTRAINTS', {
  factory: () => DEFAULT_LAYOUT_CONSTRAINTS,
});

/** Layout constraints for the app, or for a part of it (a route's or a component's providers). */
export function provideLayoutConstraints(constraints: Partial<LayoutConstraints>): Provider {
  return {
    provide: LAYOUT_CONSTRAINTS,
    useValue: { ...DEFAULT_LAYOUT_CONSTRAINTS, ...constraints },
  };
}
