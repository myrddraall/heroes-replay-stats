import { Component, input, output } from '@angular/core';
import { BLEND_GROUPS, BLENDS, type TintBlend } from '../../../scenes/play-background/scene-tints';
import { PropertyColour } from '../properties/property-colour';
import { PropertySection } from '../properties/property-section';
import { grouped, type PropertyOption, PropertySelect } from '../properties/property-select';
import { type PartTint, PRESETS } from '../../../scenes/play-background/tint-settings';

/**
 * The scene's own properties (presentational): the tint over the whole picture, chosen from one
 * list (none, a preset, or a custom one whose colour and blend are then set here), and, while the
 * sets are up, another set.
 */
@Component({
  selector: 'hrs-scene-properties',
  imports: [PropertySection, PropertySelect, PropertyColour],
  templateUrl: './scene-properties.html',
  styleUrl: './properties-panel.scss',
})
export class SceneProperties {
  readonly tint = input.required<PartTint>();
  readonly presetOptions = input.required<readonly PropertyOption[]>();
  /** The tint chosen: a preset's id (the first: none), or the custom one. */
  readonly preset = input.required<string>();
  /** Whether the tint is a custom one: its colour and blend are set here. */
  readonly custom = input(false);
  /** Whether the random sets are up (another can be drawn). */
  readonly sets = input(false);
  readonly tintChange = output<Partial<PartTint>>();
  readonly presetChange = output<string>();
  readonly anotherSet = output<void>();

  protected readonly blends = grouped(...BLEND_GROUPS);
  /** The choice that is no tint. */
  protected readonly none = PRESETS[0]!.id;

  /** Whether there is a tint (a reset puts it back to none). */
  protected tinted(): boolean {
    return this.preset() !== this.none;
  }

  protected blend(blend: string): void {
    if (BLENDS.includes(blend as TintBlend)) this.tintChange.emit({ blend: blend as TintBlend });
  }
}
