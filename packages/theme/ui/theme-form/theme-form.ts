import { Component, computed, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SettingSlider } from '@myrddraall/heroes-replay-stats-settings/ui';
import { GLASS_ALPHA_RANGE, type ThemeName, type ThemeSettings } from '../../model';

/** A glass setting set with a slider. */
interface GlassSlider {
  readonly key: 'glassAlpha' | 'frameAlpha';
  readonly label: string;
  readonly hint: string;
}

const GLASS_SLIDERS: readonly GlassSlider[] = [
  { key: 'glassAlpha', label: 'Panel opacity', hint: 'How much the glass panels hide the background.' },
  { key: 'frameAlpha', label: 'Frame opacity', hint: 'The same for the menu and the header.' },
];

/** The theme's settings (presentational): the theme, the glass's opacity, and the blur behind it. */
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

  protected readonly range = GLASS_ALPHA_RANGE;
  protected readonly themes: readonly { value: ThemeName; label: string }[] = [
    { value: 'neutral', label: 'Purple' },
    { value: 'nexus', label: 'Nexus' },
  ];
  /** The sliders with their values, as shown. */
  protected readonly glassSliders = computed(() => {
    const settings = this.settings();
    return GLASS_SLIDERS.map((slider) => ({
      ...slider,
      value: settings[slider.key],
      shown: settings[slider.key].toFixed(2),
    }));
  });

  protected change(key: GlassSlider['key'], value: number): void {
    this.changed.emit({ [key]: value });
  }
}
