import { Component, input, output } from '@angular/core';
import { BLEND_GROUPS, BLENDS, type TintBlend } from '../../../scenes/play-background/scene-tints';
import { PropertyColour } from '../properties/property-colour';
import { PropertySection } from '../properties/property-section';
import { PropertyText } from '../properties/property-text';
import { grouped, type PropertyOption, PropertySelect } from '../properties/property-select';
import { type PartTint, PRESETS } from '../../../scenes/play-background/tint-settings';

/**
 * The scene's own properties (presentational): its name and a way to delete it (a scene of its
 * own: not the random sets'), what may be put in it (its buttons given as `[planetAdd]`), the tint
 * over the whole picture, chosen from one list (none, a preset, or a custom one whose colour and
 * blend are then set here), and, while the sets are up, another set. A group's: as a scene's, but
 * the tint (the picture's, not a group's).
 */
@Component({
  selector: 'hrs-scene-properties',
  imports: [PropertySection, PropertySelect, PropertyColour, PropertyText],
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
  /** Whether planets can be put in it (a Planets section, its button given as `[planetAdd]`). */
  readonly planets = input(false);
  /** Whether it is a scene of its own (named, deletable), not the random sets'. */
  readonly own = input(false);
  /** Whether it is a group (a scene within scenes): named and deleted as one, with no tint of its own. */
  readonly group = input(false);
  /** Its name ('': none, its planet's id shown). */
  readonly name = input('');
  readonly planet = input('');
  readonly nameChange = output<string>();
  readonly deleteRequested = output<void>();
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
