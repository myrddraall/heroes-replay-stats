import { MatIcon } from '@angular/material/icon';
import { Component, input, output } from '@angular/core';
import {
  MATERIAL_BLENDS,
  NO_MATERIAL_TINT,
  type MaterialControls,
  type MaterialValues,
  type SettingOrigins,
} from '../../../scenes/play-background/material-settings';
import type { SceneBlend } from '../../../scenes/play-background/play-scene';
import type {
  MaterialDepth,
  MaterialSettings,
  MaterialTint,
  SkyAnchor,
} from '../../../scenes/play-background/scene-planets';
import { ORIENTATION_CHOICES, SKY_ANCHOR_CHOICES } from './editor-model';
import { PropertyCheck } from '../properties/property-check';
import { PropertySection } from '../properties/property-section';
import { TintSection } from './tint-section';
import { PropertySelect } from '../properties/property-select';
import { PropertyNumber } from '../properties/property-number';
import { PropertyText } from '../properties/property-text';
import { PropertyDirection } from '../properties/property-direction';

/**
 * A material's properties (presentational), in sections as a design tool shows them: how it is
 * composited into the scene (a sky material's: anchored against the camera, and at what depth), its tint, its light and its rim (only those that do anything for it).
 * Its layers, a shield shader's pattern and effects are rows of their own under it in the tree.
 */
@Component({
  selector: 'hrs-material-properties',
  imports: [
    MatIcon,
    TintSection,
    PropertySection,
    PropertyNumber,
    PropertySelect,
    PropertyDirection,
    PropertyCheck,
    PropertyText,
  ],
  templateUrl: './material-properties.html',
  styleUrl: './properties-panel.scss',
})
export class MaterialProperties {
  /** Its name in the game data (shown under its readable one, the panel's title). */
  readonly name = input<string>();
  /** Where it comes from, where it isn't its body's own (a style it wears). */
  readonly origin = input<string>();
  readonly values = input.required<MaterialValues>();
  /** Which level under the one edited sets each setting, where one does (shown by its row). */
  readonly origins = input<SettingOrigins<keyof MaterialSettings>>();
  /** Which level over the one edited wins for each of its settings, where one does (those rows marked overridden). */
  readonly overrides = input<SettingOrigins<keyof MaterialSettings>>();
  readonly controls = input.required<MaterialControls>();
  /** Whether anything of it is set here, to reset. */
  readonly changed = input(false);
  /** What of it is set here (the rest is its own). */
  readonly set = input<MaterialSettings | undefined>(undefined);
  /** Its tint where none is set here: its own (its file's), or none. */
  readonly baseTint = input<MaterialTint>(NO_MATERIAL_TINT);
  /** Its name as the levels under the one edited have it (shown while it isn't renamed here). */
  readonly labelBelow = input('');
  /** Whether it is a planet's or overlay's material, the library's own (shared) to open from here. */
  readonly shared = input(false);
  /** The library's own material (shared by all that use it) asked for: opened from here. */
  readonly sharedOpen = output<void>();
  readonly settingsChange = output<Partial<MaterialSettings>>();
  /** Settings set here to take back, so they are its own again. */
  readonly clear = output<readonly (keyof MaterialSettings)[]>();
  readonly resetRequested = output<void>();
  protected readonly blends = MATERIAL_BLENDS;
  protected readonly depthOptions: readonly { value: MaterialDepth; label: string }[] = [
    { value: 'background', label: 'Background' },
    { value: 'scene', label: 'Midground' },
    { value: 'foreground', label: 'Foreground' },
  ];
  /** The depths a sky material not anchored to the world may have: never among the scene's objects. */
  protected readonly anchoredDepthOptions = this.depthOptions.filter((o) => o.value !== 'scene');
  protected readonly anchorOptions: readonly { value: SkyAnchor; label: string }[] =
    SKY_ANCHOR_CHOICES;
  protected readonly orientations = ORIENTATION_CHOICES;
  /** The Surface section's settings (its reset takes them all back). */
  protected readonly surfaceKeys: readonly (keyof MaterialSettings)[] = [
    'strength',
    'blend',
    'depth',
    'anchor',
    'orientation',
  ];

  protected blend(blend: string): void {
    if (MATERIAL_BLENDS.includes(blend as SceneBlend))
      this.settingsChange.emit({ blend: blend as SceneBlend });
  }

  protected depth(value: string): void {
    const found = this.depthOptions.find((o) => o.value === value);
    if (found) this.settingsChange.emit({ depth: found.value });
  }

  protected orient(value: string): void {
    const found = ORIENTATION_CHOICES.find((o) => o.value === value);
    if (found) this.settingsChange.emit({ orientation: found.value });
  }

  protected anchor(value: string): void {
    const found = this.anchorOptions.find((o) => o.value === value);
    if (found) this.settingsChange.emit({ anchor: found.value });
  }

  /** Renamed here; left empty, back to its name under the level edited. */
  protected rename(value: string): void {
    const label = value.trim();
    if (label) this.settingsChange.emit({ label });
    else this.clear.emit(['label']);
  }

  protected isSet(key: keyof MaterialSettings): boolean {
    return this.set()?.[key] !== undefined;
  }

  protected anySet(keys: readonly (keyof MaterialSettings)[]): boolean {
    return keys.some((k) => this.isSet(k));
  }
}
