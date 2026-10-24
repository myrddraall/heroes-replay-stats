import { Component } from '@angular/core';
import { Layout } from '../../layout/layout';
import { SettingsPanel } from './settings-panel';

/** The Settings page: the settings in the page's layout. */
@Component({
  selector: 'hrs-settings-page',
  imports: [Layout, SettingsPanel],
  templateUrl: './settings-page.html',
})
export class SettingsPage {}
