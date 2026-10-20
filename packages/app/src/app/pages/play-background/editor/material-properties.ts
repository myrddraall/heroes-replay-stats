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
  LayerSettings,
  LayerSlot,
  MaterialDepth,
  MaterialDrawAs,
  MaterialSettings,
  MaterialTint,
} from '../../../scenes/play-background/scene-planets';
import { PropertyCheck } from '../properties/property-check';
import { PropertySection } from '../properties/property-section';
import type { LayerEntry } from './editor-model';
import { LayerProperties } from './layer-properties';
import { TintSection } from './tint-section';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { PropertyColour } from '../properties/property-colour';
import { PropertyNumber } from '../properties/property-number';
import { PropertyText } from '../properties/property-text';
import { PropertyDirection } from '../properties/property-direction';

/**
 * A material's properties (presentational), in sections as a design tool shows them: how it is
 * composited into the scene, its tint, its light, its pattern (only those that do anything for
 * it); and the textures it reads, where the site and the game data have them.
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
    PropertyColour,
    LayerProperties,
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
  readonly controls = input.required<MaterialControls>();
  /** Whether anything of it is set here, to reset. */
  readonly changed = input(false);
  /** What of it is set here (the rest is its own). */
  readonly set = input<MaterialSettings | undefined>(undefined);
  /** Its tint where none is set here: its own (its file's), or none. */
  readonly baseTint = input<MaterialTint>(NO_MATERIAL_TINT);
  /** Its layers: the textures they read and how those lie on it. */
  readonly layers = input<readonly LayerEntry[]>([]);
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
  protected readonly drawAsOptions: readonly PropertyOption[] = [
    { value: 'pattern', label: 'Hex pattern' },
    { value: 'texture', label: 'Texture (game)' },
  ];
  protected readonly depthOptions: readonly { value: MaterialDepth; label: string }[] = [
    { value: 'background', label: 'Background' },
    { value: 'scene', label: 'Midground' },
    { value: 'foreground', label: 'Foreground' },
  ];

  protected blend(blend: string): void {
    if (MATERIAL_BLENDS.includes(blend as SceneBlend))
      this.settingsChange.emit({ blend: blend as SceneBlend });
  }

  protected drawAs(value: string): void {
    if (value === 'pattern' || value === 'texture')
      this.settingsChange.emit({ drawAs: value satisfies MaterialDrawAs });
  }

  protected depth(value: string): void {
    const found = this.depthOptions.find((o) => o.value === value);
    if (found) this.settingsChange.emit({ depth: found.value });
  }

  /** A layer's settings changed: its others, and the other layers', as set here, kept. */
  protected layerChange(slot: LayerSlot, change: Partial<LayerSettings>): void {
    const layers = this.set()?.layers ?? {};
    this.settingsChange.emit({ layers: { ...layers, [slot]: { ...layers[slot], ...change } } });
  }

  /** A layer's settings taken back; no layer's left set here: the layers as they are under it. */
  protected layerClear(slot: LayerSlot, keys: readonly (keyof LayerSettings)[]): void {
    const { [slot]: own, ...others } = this.set()?.layers ?? {};
    const kept = Object.fromEntries(
      Object.entries(own ?? {}).filter(([k]) => !keys.includes(k as keyof LayerSettings)),
    );
    const layers = Object.keys(kept).length ? { ...others, [slot]: kept } : others;
    if (Object.keys(layers).length) this.settingsChange.emit({ layers });
    else this.clear.emit(['layers']);
  }

  /** Renamed here; left empty, back to its name under the level edited. */
  protected rename(value: string): void {
    const label = value.trim();
    if (label) this.settingsChange.emit({ label });
    else this.clear.emit(['label']);
  }

  /** A grid's reveal's settings, and its activation's (its active colour among them). */
  protected readonly revealKeys: readonly (keyof MaterialSettings)[] = [
    'revealOn',
    'revealStrength',
    'revealFrom',
    'revealReach',
    'revealFalloff',
  ];
  protected readonly activationKeys: readonly (keyof MaterialSettings)[] = [
    'activationOn',
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
