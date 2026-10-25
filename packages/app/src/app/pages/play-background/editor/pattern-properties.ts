import { Component, input, output } from '@angular/core';
import type {
  MaterialControls,
  MaterialValues,
  SettingOrigins,
} from '../../../scenes/play-background/material-settings';
import type {
  MaterialDrawAs,
  MaterialSettings,
} from '../../../scenes/play-background/scene-planets';
import { PropertyColour } from '../properties/property-colour';
import { PropertyNumber } from '../properties/property-number';
import { PropertySection } from '../properties/property-section';
import { type PropertyOption, PropertySelect } from '../properties/property-select';

/**
 * A material's pattern (presentational): a shield's shader's (its cells, drawn or the game's
 * texture, and its colours where inactive and where active), or any other's emissive texture (how large, how much of
 * it is cut away).
 */
@Component({
  selector: 'hrs-pattern-properties',
  imports: [PropertySection, PropertyNumber, PropertySelect, PropertyColour],
  templateUrl: './pattern-properties.html',
  styleUrl: './properties-panel.scss',
})
export class PatternProperties {
  readonly values = input.required<MaterialValues>();
  readonly controls = input.required<MaterialControls>();
  /** What of it is set here (the rest is its own). */
  readonly set = input<MaterialSettings | undefined>(undefined);
  /** Which level under the one edited sets each setting, where one does. */
  readonly origins = input<SettingOrigins<keyof MaterialSettings>>();
  /** Which level over the one edited wins for each of its settings, where one does (those rows marked overridden). */
  readonly overrides = input<SettingOrigins<keyof MaterialSettings>>();
  readonly settingsChange = output<Partial<MaterialSettings>>();
  /** Settings set here to take back, so they are its own again. */
  readonly clear = output<readonly (keyof MaterialSettings)[]>();
  protected readonly drawAsOptions: readonly PropertyOption[] = [
    { value: 'pattern', label: 'Hex pattern' },
    { value: 'texture', label: 'Texture (game)' },
  ];

  protected drawAs(value: string): void {
    if (value === 'pattern' || value === 'texture')
      this.settingsChange.emit({ drawAs: value satisfies MaterialDrawAs });
  }

  protected isSet(key: keyof MaterialSettings): boolean {
    return this.set()?.[key] !== undefined;
  }

  protected anySet(keys: readonly (keyof MaterialSettings)[]): boolean {
    return keys.some((k) => this.isSet(k));
  }
}
