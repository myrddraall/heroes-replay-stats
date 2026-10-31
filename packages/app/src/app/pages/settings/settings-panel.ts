import { Component, inject } from '@angular/core';
import { GraphicsForm } from './graphics-form';
import { SettingsForm } from './settings-form';
import { SettingsPageStore } from './settings-page.store';

/** The settings (container): shown by the Settings page, and in a dialog over the Background editor. */
@Component({
  selector: 'hrs-settings-panel',
  imports: [SettingsForm, GraphicsForm],
  templateUrl: './settings-panel.html',
  providers: [SettingsPageStore],
})
export class SettingsPanel {
  protected readonly store = inject(SettingsPageStore);
}
