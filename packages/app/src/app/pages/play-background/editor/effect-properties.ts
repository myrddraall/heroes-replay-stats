import { Component, input, output } from '@angular/core';
import type {
  MaterialValues,
  SettingOrigins,
} from '../../../scenes/play-background/material-settings';
import type { MaterialSettings } from '../../../scenes/play-background/scene-planets';
import { PropertyCheck } from '../properties/property-check';
import { PropertyColour } from '../properties/property-colour';
import { PropertyDirection } from '../properties/property-direction';
import { PropertyNumber } from '../properties/property-number';
import { PropertySection } from '../properties/property-section';
import type { GridEffect } from './editor-model';

/**
 * One of a shield shader's effects (presentational), its material's: its reveal (where the grid
 * shows at all), or its activation (where it turns from its inactive colour to its active one);
 * each shaped as a light reaches a face. Whether it is on is its row's checkbox in the tree.
 */
@Component({
  selector: 'hrs-effect-properties',
  imports: [PropertySection, PropertyCheck, PropertyNumber, PropertyDirection, PropertyColour],
  templateUrl: './effect-properties.html',
  styleUrl: './properties-panel.scss',
})
export class EffectProperties {
  readonly effect = input.required<GridEffect>();
  readonly values = input.required<MaterialValues>();
  /** What of it is set here (the rest is its own). */
  readonly set = input<MaterialSettings | undefined>(undefined);
  /** Which level under the one edited sets each setting, where one does. */
  readonly origins = input<SettingOrigins<keyof MaterialSettings>>();
  readonly settingsChange = output<Partial<MaterialSettings>>();
  /** Settings set here to take back, so they are its own again. */
  readonly clear = output<readonly (keyof MaterialSettings)[]>();
  protected readonly revealKeys: readonly (keyof MaterialSettings)[] = [
    'revealStrength',
    'revealFrom',
    'revealReach',
    'revealFalloff',
  ];
  protected readonly activationKeys: readonly (keyof MaterialSettings)[] = [
    'active',
    'activationStrength',
    'activationTied',
    'activationFrom',
    'activationReach',
    'activationFalloff',
    'activationEnergizes',
    'activationGlow',
  ];

  protected isSet(key: keyof MaterialSettings): boolean {
    return this.set()?.[key] !== undefined;
  }

  protected anySet(keys: readonly (keyof MaterialSettings)[]): boolean {
    return keys.some((k) => this.isSet(k));
  }
}
