import { InjectionToken, type Provider, type Type } from '@angular/core';

/** A section of the settings, added by the domain whose settings it shows. */
export interface SettingsSection {
  /** Unique among the sections. */
  readonly id: string;
  /** Sections show in ascending order, after the Importing section. */
  readonly order: number;
  /** The section: a component that injects what it shows. */
  readonly component: Type<unknown>;
}

/** The sections other domains add to the settings (`provideSettingsSection`). */
export const SETTINGS_SECTIONS = new InjectionToken<readonly SettingsSection[]>(
  'hrs.settings-sections',
  { factory: () => [] },
);

/** Adds a section to the settings page and dialog. */
export function provideSettingsSection(section: SettingsSection): Provider {
  return { provide: SETTINGS_SECTIONS, useValue: section, multi: true };
}
