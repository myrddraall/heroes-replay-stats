import { Component, input, output } from '@angular/core';
import {
  MATERIAL_BLENDS,
  NO_MATERIAL_TINT,
  type MaterialControls,
  type MaterialValues,
} from '../../../scenes/play-background/material-settings';
import type { SceneBlend } from '../../../scenes/play-background/play-scene';
import type { MaterialSettings, MaterialTint } from '../../../scenes/play-background/scene-planets';
import { PropertySection } from '../properties/property-section';
import type { TextureEntry } from './editor-model';
import { TintSection } from './tint-section';
import { PropertySelect } from '../properties/property-select';
import { PropertySlider } from '../properties/property-slider';

/**
 * A material's properties (presentational), in sections as a design tool shows them: how it is
 * composited into the scene, its tint, its light, its pattern (only those that do anything for
 * it); and the textures it reads, where the site and the game data have them.
 */
@Component({
  selector: 'hrs-material-properties',
  imports: [TintSection, PropertySection, PropertySlider, PropertySelect],
  templateUrl: './material-properties.html',
  styleUrl: './properties-panel.scss',
})
export class MaterialProperties {
  readonly values = input.required<MaterialValues>();
  readonly controls = input.required<MaterialControls>();
  /** Whether anything of it is set here, to reset. */
  readonly changed = input(false);
  /** What of it is set here (the rest is its own). */
  readonly set = input<MaterialSettings | undefined>(undefined);
  /** Its tint where none is set here: its own (its file's), or none. */
  readonly baseTint = input<MaterialTint>(NO_MATERIAL_TINT);
  /** The textures its layers read. */
  readonly textures = input<readonly TextureEntry[]>([]);
  readonly settingsChange = output<Partial<MaterialSettings>>();
  /** Settings set here to take back, so they are its own again. */
  readonly clear = output<readonly (keyof MaterialSettings)[]>();
  readonly resetRequested = output<void>();
  protected readonly blends = MATERIAL_BLENDS;

  protected blend(blend: string): void {
    if (MATERIAL_BLENDS.includes(blend as SceneBlend))
      this.settingsChange.emit({ blend: blend as SceneBlend });
  }

  protected isSet(key: keyof MaterialSettings): boolean {
    return this.set()?.[key] !== undefined;
  }

  protected anySet(keys: readonly (keyof MaterialSettings)[]): boolean {
    return keys.some((k) => this.isSet(k));
  }
}
