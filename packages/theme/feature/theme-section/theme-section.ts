import { Component, computed, inject } from '@angular/core';
import { getState } from '@ngrx/signals';
import { ThemeStore } from '../../data';
import type { ThemeSettings } from '../../model';
import { ThemeForm } from '../../ui';

/** The Theme section of the settings (smart), added through `provideSettingsSection`. */
@Component({
  selector: 'hrs-theme-section',
  imports: [ThemeForm],
  template: `<hrs-theme-form [settings]="settings()" (changed)="theme.set($event)" />`,
})
export class ThemeSection {
  protected readonly theme = inject(ThemeStore);
  protected readonly settings = computed((): ThemeSettings => getState(this.theme));
}
