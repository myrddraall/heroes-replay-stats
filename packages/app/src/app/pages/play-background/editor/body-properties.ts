import { Component, input, output } from '@angular/core';
import type { MaterialTint } from '../../../scenes/play-background/scene-planets';
import {
  type BodySettings,
  type BodyValues,
  DEFAULT_ORBIT,
  type Orbit,
  type Vec3,
} from '../../../scenes/play-background/background-scene';
import { NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import { PropertyDirection } from '../properties/property-direction';
import { PropertySection } from '../properties/property-section';
import { TintSection } from './tint-section';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { PropertySlider } from '../properties/property-slider';

/**
 * A body's properties (presentational): the planet's or a moon's style, its light, shade and
 * their directions, the lean of its rims, a tint over all its materials; a moon's orbit about its
 * parent, or a scene's planet's place and size; and its Moons section, whose button to add one
 * is given (`[moonAdd]`).
 */
@Component({
  selector: 'hrs-body-properties',
  imports: [TintSection, PropertySection, PropertySlider, PropertySelect, PropertyDirection],
  templateUrl: './body-properties.html',
  styleUrl: './properties-panel.scss',
})
export class BodyProperties {
  readonly values = input.required<BodyValues>();
  readonly styleOptions = input.required<readonly PropertyOption[]>();
  /** Whether it is lit (its light's strength and direction apply). */
  readonly canLight = input(false);
  /** Its orbit, where it is a moon. */
  readonly orbit = input<Orbit | null>(null);
  /** Where it is and how big, where it is one of a scene's planets (x across, y away, z up). */
  readonly place = input<{ readonly position: Vec3; readonly radius: number } | null>(null);
  /** Whether anything of it is set here, to reset. */
  readonly changed = input(false);
  /** Whether the view is centred on it. */
  readonly focused = input(false);
  /** Whether it can wear a style, and have moons put about it (a scene's bodies; not the library's). */
  readonly styled = input(true);
  readonly moons = input(true);
  /** What of it is set here (the rest is its own). */
  readonly set = input<BodySettings>({});
  /** Its tint where none is set here: its own (its file's), or none. */
  readonly baseTint = input<MaterialTint>(NO_MATERIAL_TINT);
  /** Whether its style is chosen here (else its own). */
  readonly styleSet = input(false);
  readonly styleChange = output<string>();
  readonly settingsChange = output<Partial<BodySettings>>();
  readonly orbitChange = output<Partial<Orbit>>();
  readonly placeChange = output<{ readonly position?: Vec3; readonly radius?: number }>();
  readonly removeRequested = output<void>();
  readonly focusToggle = output<void>();
  readonly resetRequested = output<void>();
  /** Settings set here to take back, so they are its own again. */
  readonly clear = output<readonly (keyof BodySettings)[]>();
  /** Its style back to its own. */
  readonly styleReset = output<void>();
  /** The light section's settings. */
  protected readonly lightKeys: readonly (keyof BodySettings)[] = [
    'lighting',
    'lightFrom',
    'shade',
    'shadeTowards',
    'rim',
  ];

  protected isSet(key: keyof BodySettings): boolean {
    return this.set()[key] !== undefined;
  }

  protected anySet(keys: readonly (keyof BodySettings)[]): boolean {
    return keys.some((k) => this.isSet(k));
  }

  /** Whether its orbit (or one part of it) is other than a new moon's. */
  protected orbitSet(field?: keyof Orbit): boolean {
    const orbit = this.orbit();
    if (!orbit) return false;
    const fields = field ? [field] : (Object.keys(DEFAULT_ORBIT) as (keyof Orbit)[]);
    return fields.some((f) => orbit[f] !== DEFAULT_ORBIT[f]);
  }

  /** A planet moved along one axis (0 across, 1 away, 2 up). */
  protected move(axis: 0 | 1 | 2, value: number): void {
    const place = this.place();
    if (!place) return;
    const position: [number, number, number] = [...place.position];
    position[axis] = value;
    this.placeChange.emit({ position });
  }

  /** Its orbit (or one part of it) back to a new moon's. */
  protected resetOrbit(field?: keyof Orbit): void {
    this.orbitChange.emit(field ? { [field]: DEFAULT_ORBIT[field] } : DEFAULT_ORBIT);
  }
}
