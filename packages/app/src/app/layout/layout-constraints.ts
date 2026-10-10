import { InjectionToken, type Provider } from '@angular/core';

/**
 * How a layout constrains the children placed in it: the width a `constrained` child is centred
 * within, the padding round a child, and the narrower padding a narrow layout uses.
 */
export interface LayoutConstraints {
  /** CSS pixels. */
  readonly maxWidth: number;
  readonly padding: number;
  readonly narrowPadding: number;
  /** A layout narrower than this (CSS pixels) uses `narrowPadding`. */
  readonly narrowBelow: number;
}

export const DEFAULT_LAYOUT_CONSTRAINTS: LayoutConstraints = {
  maxWidth: 1400,
  padding: 24,
  narrowPadding: 16,
  narrowBelow: 600,
};

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
