import { InjectionToken, type Provider, type Signal, signal, type Type } from '@angular/core';
import {
  SHELL_AREAS,
  SHELL_MENU_ITEMS,
  SHELL_SECTIONS,
  SHELL_UTILITY_LINKS,
  type ShellArea,
  type ShellMenuItem,
  type ShellSection,
  type ShellUtilityLink,
} from '../model';

/** An area on the top bar, added by the domain whose pages it holds (or the app, for one that gathers several). */
export function provideShellArea(area: ShellArea): Provider {
  return { provide: SHELL_AREAS, useValue: area, multi: true };
}

/** A fixed section of an area (Game's Maps), added by the domain whose page it opens. */
export function provideShellSection(section: ShellSection): Provider {
  return { provide: SHELL_SECTIONS, useValue: section, multi: true };
}

/**
 * A page the domain's utility (its component in the top bar's cluster) leads to, listed in the
 * tree after the areas, for where the cluster has no room (a handset).
 */
export function provideShellUtilityLink(link: ShellUtilityLink): Provider {
  return { provide: SHELL_UTILITY_LINKS, useValue: link, multi: true };
}

/** An entry of the settings menu, added by the domain whose page it opens. */
export function provideShellMenuItem(item: ShellMenuItem): Provider {
  return { provide: SHELL_MENU_ITEMS, useValue: item, multi: true };
}

/** What other domains show in the top bar's utility cluster: components that inject what they show. */
export const SHELL_TOOLBAR_ACTIONS = new InjectionToken<readonly Type<unknown>[]>(
  'hrs.shell-toolbar-actions',
  { factory: () => [] },
);

export function provideShellToolbarAction(component: Type<unknown>): Provider {
  return { provide: SHELL_TOOLBAR_ACTIONS, useValue: component, multi: true };
}

/** Files dropped on the page, for the domain that takes them. */
export interface ShellFileDrop {
  /** What the drop overlay says while files are dragged over the page. */
  readonly label: string;
  /** The overlay's Material Symbols icon. */
  readonly icon: string;
  accepts(file: File): boolean;
  drop(files: readonly File[]): void;
}

/** What takes files dropped on the page (`provideShellFileDrop`); none, and dragging files shows nothing. */
export const SHELL_FILE_DROPS = new InjectionToken<readonly ShellFileDrop[]>('hrs.shell-file-drops', {
  factory: () => [],
});

/** `drop`: made in an injection context, so it can inject what takes the files. */
export function provideShellFileDrop(drop: () => ShellFileDrop): Provider {
  return { provide: SHELL_FILE_DROPS, useFactory: drop, multi: true };
}

/**
 * What the shell shows behind every page it frames, fixed to the window: a component, loaded once
 * the browser is idle after the first page is up, so what it needs stays out of the first download
 * (none: nothing).
 */
export const SHELL_BACKDROP = new InjectionToken<(() => Promise<Type<unknown>>) | null>(
  'hrs.shell-backdrop',
  { factory: () => null },
);

/** `load`: a dynamic `import()` of the backdrop's component. */
export function provideShellBackdrop(load: () => Promise<Type<unknown>>): Provider {
  return { provide: SHELL_BACKDROP, useValue: load };
}

/** How the shell looks: its theme, how solid its films are, and whether they blur. */
export interface ShellLook {
  /** The neutral theme the shell carries (`theme`). */
  readonly theme: Signal<string>;
  /** How solid every film is, from its legibility floor (0) to solid (1). */
  readonly opacity: Signal<number>;
  readonly blur: Signal<boolean>;
}

/** The shell's look (`provideShellLook`); the purple theme at its floors unless provided. */
export const SHELL_LOOK = new InjectionToken<ShellLook>('hrs.shell-look', {
  factory: () => ({ theme: signal('purple'), opacity: signal(0), blur: signal(false) }),
});

/** `look`: made in an injection context, so it can read what sets it. */
export function provideShellLook(look: () => ShellLook): Provider {
  return { provide: SHELL_LOOK, useFactory: look };
}
