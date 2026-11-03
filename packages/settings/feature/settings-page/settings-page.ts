import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { SettingsPanel } from '../settings-panel/settings-panel';

/** The Settings page: the settings in the page's layout, scrolled to the part the address names (`#about`). */
@Component({
  selector: 'hrs-settings-page',
  imports: [Layout, SettingsPanel],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  protected readonly fragment = toSignal(inject(ActivatedRoute).fragment);
}
