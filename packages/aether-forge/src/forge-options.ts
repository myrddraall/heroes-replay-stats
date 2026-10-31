import { InjectionToken, type Signal } from '@angular/core';

/** What the app tells the editor (`provideAetherForge`), as the editor reads it. */
export interface ForgeOptions {
  /** The editor's URL under the app's root, without slashes (`edit-background`). */
  readonly path: string;
  /** Where leaving the editor goes when it was opened on its own. */
  readonly exit: string;
  /** The class the app's theme styles glass panels with, on the editor and its pop-ups. */
  readonly panelClass: Signal<string>;
  /** Opens the app's settings, from the view menu; none: the menu has no such item. */
  readonly openSettings: (() => void) | null;
}

export const FORGE_OPTIONS = new InjectionToken<ForgeOptions>('FORGE_OPTIONS');
