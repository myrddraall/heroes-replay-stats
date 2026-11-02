import { NgComponentOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SettingsPageStore } from '../../data';
import { SETTINGS_SECTIONS, SettingsForm } from '../../ui';

/**
 * The settings (container): shown by the Settings page, and in a dialog over the Background editor.
 * The Importing section and the About line are its own; the other sections come from the domains
 * that add them (`provideSettingsSection`).
 */
@Component({
  selector: 'hrs-settings-panel',
  imports: [NgComponentOutlet, SettingsForm],
  templateUrl: './settings-panel.html',
  providers: [SettingsPageStore],
})
export class SettingsPanel {
  protected readonly store = inject(SettingsPageStore);
  protected readonly sections = [...inject(SETTINGS_SECTIONS)].sort((a, b) => a.order - b.order);
}
