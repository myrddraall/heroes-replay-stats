import { InjectionToken } from '@angular/core';
import type { ShellArea, ShellMenuItem, ShellSection, ShellUtilityLink } from './shell-nav';

/** The site's level-1 areas (`provideShellArea`). */
export const SHELL_AREAS = new InjectionToken<readonly ShellArea[]>('hrs.shell-areas', {
  factory: () => [],
});

/** The areas' fixed level-2 sections (`provideShellSection`). */
export const SHELL_SECTIONS = new InjectionToken<readonly ShellSection[]>('hrs.shell-sections', {
  factory: () => [],
});

/** The pages the utility cluster leads to, for the tree (`provideShellUtilityLink`). */
export const SHELL_UTILITY_LINKS = new InjectionToken<readonly ShellUtilityLink[]>(
  'hrs.shell-utility-links',
  { factory: () => [] },
);

/** The settings menu's entries (`provideShellMenuItem`). */
export const SHELL_MENU_ITEMS = new InjectionToken<readonly ShellMenuItem[]>('hrs.shell-menu-items', {
  factory: () => [],
});
