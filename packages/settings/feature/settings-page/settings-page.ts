import { Component } from '@angular/core';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { SettingsPanel } from '../settings-panel/settings-panel';

/** The Settings page: the settings in the page's layout. */
@Component({
  selector: 'hrs-settings-page',
  imports: [Layout, SettingsPanel],
  templateUrl: './settings-page.html',
})
export class SettingsPage {}
