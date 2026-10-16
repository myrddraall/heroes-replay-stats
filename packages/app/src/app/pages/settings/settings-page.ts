import { Component, inject } from '@angular/core';
import { GraphicsForm } from './graphics-form';
import { SettingsForm } from './settings-form';
import { SettingsPageStore } from './settings-page.store';
import { Layout } from '../../layout/layout';

/** The settings (container). */
@Component({
  selector: 'hrs-settings-page',
  imports: [Layout, SettingsForm, GraphicsForm],
  templateUrl: './settings-page.html',
  providers: [SettingsPageStore],
})
export class SettingsPage {
  protected readonly store = inject(SettingsPageStore);
}
