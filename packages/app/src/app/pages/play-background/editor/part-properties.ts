import { Component, computed, input, output } from '@angular/core';
import type { PartSettings } from '../../../scenes/play-background/scene-planets';
import { PropertyCheck } from '../properties/property-check';
import { PropertyNumber } from '../properties/property-number';
import { PropertySection } from '../properties/property-section';
import { PropertyText } from '../properties/property-text';
import type { PartEntry } from './editor-model';

/** A part's shape's settings (its name and its switch are apart). */
const SHAPE_KEYS: readonly (keyof PartSettings)[] = [
  'size',
  'turn',
  'tilt',
  'width',
  'depth',
  'mid',
  'keepToLimb',
];

/**
 * A body's part's properties (presentational), relative to its body (so a style's part fits any
 * planet wearing it): a sphere's size and how its textures are turned on it (about its pole, and
 * its top tilted towards the eye); a ring's size, width, depth along the line of sight, the circle
 * its texture is brightest on, and whether it keeps to its body's limb.
 */
@Component({
  selector: 'hrs-part-properties',
  imports: [PropertySection, PropertyNumber, PropertyCheck, PropertyText],
  templateUrl: './part-properties.html',
  styleUrl: './properties-panel.scss',
})
export class PartProperties {
  readonly part = input.required<PartEntry>();
  readonly settingsChange = output<Partial<PartSettings>>();
  /** Settings set here to take back (none given: all of them). */
  readonly clear = output<readonly (keyof PartSettings)[] | undefined>();
  protected readonly shapeKeys = SHAPE_KEYS;
  protected readonly changed = computed(() => SHAPE_KEYS.some((k) => this.isSet(k)));

  /** Renamed here; left empty, back to its name under the level edited. */
  protected rename(value: string): void {
    const label = value.trim();
    if (label) this.settingsChange.emit({ label });
    else this.clear.emit(['label']);
  }

  protected isSet(key: keyof PartSettings): boolean {
    return this.part().set?.[key] !== undefined;
  }
}
