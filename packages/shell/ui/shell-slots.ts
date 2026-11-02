import { InjectionToken, type Provider, type Signal, signal, type Type } from '@angular/core';

/** An item of the shell's main navigation, added by the domain whose page it opens. */
export interface ShellNavItem {
  readonly path: string;
  readonly label: string;
  /** A Material Symbols name. */
  readonly icon: string;
  /** Items show in ascending order. */
  readonly order: number;
}

/** The shell's main navigation (`provideShellNavItem`). */
export const SHELL_NAV_ITEMS = new InjectionToken<readonly ShellNavItem[]>('hrs.shell-nav-items', {
  factory: () => [],
});

export function provideShellNavItem(item: ShellNavItem): Provider {
  return { provide: SHELL_NAV_ITEMS, useValue: item, multi: true };
}

/** What other domains show at the end of the shell's toolbar: components that inject what they show. */
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

/** How the shell's glass looks: its theme, how see-through it is, and whether it blurs. */
export interface ShellLook {
  readonly theme: Signal<string>;
  /** The panels' opacity. */
  readonly glassAlpha: Signal<number>;
  /** The frame's (the menu and the header). */
  readonly frameAlpha: Signal<number>;
  readonly blur: Signal<boolean>;
}

/** The shell's look (`provideShellLook`); the neutral glass unless provided. */
export const SHELL_LOOK = new InjectionToken<ShellLook>('hrs.shell-look', {
  factory: () => ({
    theme: signal('neutral'),
    glassAlpha: signal(0.5),
    frameAlpha: signal(0.55),
    blur: signal(false),
  }),
});

/** `look`: made in an injection context, so it can read what sets it. */
export function provideShellLook(look: () => ShellLook): Provider {
  return { provide: SHELL_LOOK, useFactory: look };
}
