import { InjectionToken, inject } from '@angular/core';
import type { Platform } from '../model';

export const PLATFORM = new InjectionToken<Platform>('hrs.platform');

export function injectPlatform(): Platform {
  return inject(PLATFORM);
}
