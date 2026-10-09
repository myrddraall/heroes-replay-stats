import { Component, inject } from '@angular/core';
import { SettingsForm } from './settings-form';
import { SettingsPageStore } from './settings-page.store';

/** The settings (container). */
@Component({
  selector: 'hrs-settings-page',
  imports: [SettingsForm],
  templateUrl: './settings-page.html',
  providers: [SettingsPageStore],
})
export class SettingsPage {
  protected readonly store = inject(SettingsPageStore);
}
