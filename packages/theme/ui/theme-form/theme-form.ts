import { Component, computed, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SettingSlider } from '@myrddraall/heroes-replay-stats-settings/ui';
import type { NeutralTheme, ThemeSettings } from '../../model';

/** The theme's settings (presentational): the theme, how solid the panels are, and the blur behind them. */
@Component({
  selector: 'hrs-theme-form',
  imports: [MatButtonToggleModule, MatSlideToggleModule, SettingSlider],
  templateUrl: './theme-form.html',
  styleUrl: './theme-form.scss',
})
export class ThemeForm {
  readonly settings = input.required<ThemeSettings>();
  /** The user changed settings. */
  readonly changed = output<Partial<ThemeSettings>>();

  protected readonly themes: readonly { value: NeutralTheme; label: string }[] = [
    { value: 'purple', label: 'Purple' },
    { value: 'magenta', label: 'Magenta' },
    { value: 'cyan', label: 'Cyan' },
  ];
  /** The opacity as shown. */
  protected readonly opacity = computed(() => `${Math.round(this.settings().opacity * 100)}%`);
}
