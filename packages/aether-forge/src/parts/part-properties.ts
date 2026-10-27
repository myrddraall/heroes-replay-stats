import { Component, computed, input, output } from '@angular/core';
import type { PartSettings } from '@myrddraall/heroes-replay-stats-aether/formats';
import { PropertyCheck } from '../controls/rows/property-check';
import { PropertyNumber } from '../controls/rows/property-number';
import { PropertySection } from '../controls/property-section';
import { PropertyText } from '../controls/rows/property-text';
import { type PropertyOption, PropertySelect } from '../controls/rows/property-select';
import { ORIENTATION_CHOICES } from '../sky/sky';
import type { PartEntry } from './parts';
/** A part's shape's settings (its name and its switch are apart). */
const SHAPE_KEYS: readonly (keyof PartSettings)[] = [
  'size',
  'turn',
  'tilt',
  'width',
  'height',
  'depth',
  'mid',
  'keepToLimb',
  'flip',
  'side',
  'from',
  'repeat',
];

/** Which side of a tube or cone shows, as its Seen from list offers it. */
const SIDES: readonly PropertyOption[] = [
  { value: 'near', label: 'Outside' },
  { value: 'far', label: 'Inside' },
];

/**
 * A body's part's properties (presentational), relative to its body (so a style's part fits any
 * planet wearing it): a sphere's size and how its textures are turned on it (about its pole, and
 * its top tilted towards the eye); a ring's size, width, depth along the line of sight, the circle
 * its texture is brightest on, and whether it keeps to its body's limb; a tube's or a cone's size,
 * side (its outside or its inside), length, tilt and its texture's turn, repeats and mirror (a
 * disc's: its width in place of the side and length); which way it is turned (facing the camera or
 * fixed in the world, over its body's). A sky overlay's part, about the eye: how far (size),
 * turned round the eye and tilted up, and a band how wide.
 */
@Component({
  selector: 'forge-part-properties',
  imports: [PropertySection, PropertyNumber, PropertyCheck, PropertyText, PropertySelect],
  templateUrl: './part-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class PartProperties {
  readonly part = input.required<PartEntry>();
  /** Whether it can be taken out (a part of an overlay made in the editor). */
  readonly removable = input(false);
  readonly removeRequested = output<void>();
  readonly settingsChange = output<Partial<PartSettings>>();
  /** Settings set here to take back (none given: all of them). */
  readonly clear = output<readonly (keyof PartSettings)[] | undefined>();
  protected readonly shapeKeys = SHAPE_KEYS;
  protected readonly sides = SIDES;
  protected readonly orientations = ORIENTATION_CHOICES;
  protected readonly changed = computed(() => SHAPE_KEYS.some((k) => this.isSet(k)));

  protected orient(value: string): void {
    const found = ORIENTATION_CHOICES.find((o) => o.value === value);
    if (found) this.settingsChange.emit({ orientation: found.value });
  }

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
