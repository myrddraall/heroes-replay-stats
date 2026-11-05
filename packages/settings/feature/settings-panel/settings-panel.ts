import { NgComponentOutlet } from '@angular/common';
import { Component, inject, signal, type Type } from '@angular/core';
import { SettingsPageStore } from '../../data';
import { SETTINGS_SECTIONS, SettingsForm } from '../../ui';

/**
 * The settings (container): shown by the Settings page, and in a dialog over the Background editor.
 * The Importing section is its own; the other sections come from the domains that add them
 * (`provideSettingsSection`).
 */
@Component({
  selector: 'hrs-settings-panel',
  imports: [NgComponentOutlet, SettingsForm],
  templateUrl: './settings-panel.html',
  providers: [SettingsPageStore],
})
export class SettingsPanel {
  protected readonly store = inject(SettingsPageStore);
  /** The other domains' sections, in order, once loaded. */
  protected readonly sections = signal<readonly { id: string; component: Type<unknown> }[]>([]);

  constructor() {
    const sections = [...inject(SETTINGS_SECTIONS)].sort((a, b) => a.order - b.order);
    void Promise.all(sections.map(async ({ id, load }) => ({ id, component: await load() }))).then(
      (all) => this.sections.set(all),
    );
  }
}
