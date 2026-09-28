import { Component, inject } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';
import {
  defaultParallelImports,
  deviceCores,
  MAX_PARALLEL_IMPORTS,
  MIN_PARALLEL_IMPORTS,
  SettingsStore,
} from '../../data/settings/settings.store';
import { injectPlatform } from '../../platform/platform';

@Component({
  selector: 'hrs-settings-page',
  imports: [MatSliderModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  protected readonly platform = injectPlatform();
  protected readonly settings = inject(SettingsStore);
  protected readonly min = MIN_PARALLEL_IMPORTS;
  protected readonly max = MAX_PARALLEL_IMPORTS;
  protected readonly cores = deviceCores() ?? null;
  protected readonly deviceDefault = defaultParallelImports(deviceCores());
}
