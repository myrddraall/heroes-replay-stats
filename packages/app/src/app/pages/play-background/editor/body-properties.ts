import { Component, computed, input, output } from '@angular/core';
import type { MaterialTint } from '../../../scenes/play-background/scene-planets';
import {
  type BodySettings,
  type BodyValues,
  DEFAULT_ORBIT,
  type Orbit,
  ORBIT_KEYS,
  orbitOffset,
  type Vec3,
} from '../../../scenes/play-background/background-scene';
import {
  NO_MATERIAL_TINT,
  type SettingOrigins,
} from '../../../scenes/play-background/material-settings';
import { PropertyDirection } from '../properties/property-direction';
import { PropertySection } from '../properties/property-section';
import { TintSection } from './tint-section';
import { PickList, type PickChoice } from './pick-list';
import { PropertyNumber } from '../properties/property-number';
import { type PlacementChange, PropertyPlacement } from '../properties/property-placement';
import { PropertyText } from '../properties/property-text';

/**
 * A body's properties (presentational): the overlays the planet or moon wears, its lights as a whole
 * (how strongly they light it, and all of them turned together; each light, its shadow too, is a
 * row of its own in the tree), the lean of its rims, a tint over all its materials; a moon's orbit about its
 * parent, or a scene's planet's place and size; its Moons section given (`[moonsPod]`: adding
 * one, those it has), and its Lights section (`[lightAdd]`: adding one, what lights it).
 */
@Component({
  selector: 'hrs-body-properties',
  imports: [
    TintSection,
    PropertySection,
    PropertyNumber,
    PickList,
    PropertyDirection,
    PropertyText,
    PropertyPlacement,
  ],
  templateUrl: './body-properties.html',
  styleUrl: './properties-panel.scss',
})
export class BodyProperties {
  readonly values = input.required<BodyValues>();
  /** Which level under the one edited sets each setting, where one does (shown by its row). */
  readonly origins = input<SettingOrigins<keyof BodySettings>>();
  /**
   * The side its rims and glows come from: the bright side, opposite the point they lean to (what
   * is kept), as every direction here is a side something comes from.
   */
  protected readonly rimFrom = computed(() => this.mirrored(this.values().rim));
  /** The overlays it may wear, by id and name. */
  readonly overlayOptions = input.required<readonly PickChoice[]>();
  /** Its orbit, where it is a moon. */
  readonly orbit = input<Orbit | null>(null);
  /** Its orbit under the level edited (reset to; its planet's for a moon of its own, else a new moon's). */
  readonly orbitBase = input<Orbit>(DEFAULT_ORBIT);
  /** Whether it is one of its planet's own moons: it can't be taken out of a scene (switched off instead). */
  readonly inherited = input(false);
  /** Whether the view can be centred on it (a scene's moons). */
  readonly focusable = input(true);
  /** Where it is and how big, where it is one of a scene's planets (x across, y away, z up). */
  readonly place = input<{ readonly position: Vec3; readonly radius: number } | null>(null);
  /** Whether anything of it is set here, to reset. */
  readonly changed = input(false);
  /** Whether the view is centred on it. */
  readonly focused = input(false);
  /** Whether it can wear overlays, and have moons put about it (a scene's bodies; not the library's). */
  readonly styled = input(true);
  readonly moons = input(true);
  /** Whether lights can be added to it (not a sky's overlay: no light lights the sky). */
  readonly lit = input(true);
  /** What of it is set here (the rest is its own). */
  readonly set = input<BodySettings>({});
  /** Its tint where none is set here: its own (its file's), or none. */
  readonly baseTint = input<MaterialTint>(NO_MATERIAL_TINT);
  /** Whether what it wears is chosen here (else its own). */
  readonly overlaysSet = input(false);
  /**
   * Whether it is an overlay itself (one open in the library): only what an overlay brings
   * applies to the bodies wearing it (its materials, parts, lights, shade), so its light (how
   * strongly, from where, its rims' lean) and its tint, a body's own, aren't offered.
   */
  readonly overlay = input(false);
  /** Its name as shown, and as the levels under the one edited have it. */
  readonly label = input('');
  readonly labelBelow = input('');
  /** An overlay put on it (over what it wears), or taken off. */
  readonly overlayAdd = output<string>();
  readonly overlayRemove = output<string>();
  /** An overlay it wears shown in the tree, its rows unfolded. */
  readonly overlayShow = output<string>();
  /** A new overlay made, and worn. */
  readonly overlayNew = output<void>();
  readonly settingsChange = output<Partial<BodySettings>>();
  readonly orbitChange = output<Partial<Orbit>>();
  readonly placeChange = output<{ readonly position?: Vec3; readonly radius?: number }>();
  readonly removeRequested = output<void>();
  /** Whether it can be deleted (an overlay made in the editor), and its deleting asked for. */
  readonly deletable = input(false);
  readonly deleteRequested = output<void>();
  readonly focusToggle = output<void>();
  readonly resetRequested = output<void>();
  /** Settings set here to take back, so they are its own again. */
  readonly clear = output<readonly (keyof BodySettings)[]>();
  /** What it wears back to its own. */
  readonly overlaysReset = output<void>();

  protected isSet(key: keyof BodySettings): boolean {
    return this.set()[key] !== undefined;
  }

  /** Whether its orbit (or one part of it) is other than under the level edited. */
  protected orbitSet(field?: keyof Orbit): boolean {
    const orbit = this.orbit();
    if (!orbit) return false;
    const base = this.orbitBase();
    const fields = field ? [field] : ORBIT_KEYS;
    return fields.some((f) => orbit[f] !== base[f]);
  }

  /** A planet moved along one axis (0 across, 1 away, 2 up). */
  protected move(axis: 0 | 1 | 2, value: number): void {
    const place = this.place();
    if (!place) return;
    const position: [number, number, number] = [...place.position];
    position[axis] = value;
    this.placeChange.emit({ position });
  }

  /** Its orbit (or some of it) back to what is under the level edited. */
  protected resetOrbit(fields: readonly (keyof Orbit)[] = ORBIT_KEYS): void {
    const base = this.orbitBase();
    this.orbitChange.emit(Object.fromEntries(fields.map((f) => [f, base[f]])));
  }

  /** How a moon is placed: what keeps its place (not its size). */
  protected readonly placeKeys: readonly (keyof Orbit)[] = [
    'radius',
    'tilt',
    'turn',
    'progress',
    'mode',
  ];
  /** Whether a moon's place (or how it is set) is other than under the level edited. */
  protected readonly placeSet = computed(() => this.placeKeys.some((k) => this.orbitSet(k)));
  /** Where a moon is from its parent's middle. */
  protected readonly moonPosition = computed(() => {
    const o = this.orbit();
    return o ? orbitOffset(o) : ([0, 0, 0] as const);
  });

  /** A moon placed: its orbit through where it is now (its turn kept), and how it is set. */
  protected placeMoon(change: PlacementChange): void {
    this.orbitChange.emit({ ...change.orbit, ...(change.mode ? { mode: change.mode } : {}) });
  }

  /** A point on the face mirrored through its centre, on the same side: a lean and the side it is bright on. */
  protected mirrored(d: readonly [number, number, number]): [number, number, number] {
    return [-d[0], d[1], -d[2]];
  }

  /** Renamed here; left empty, back to its name under the level edited. */
  protected rename(value: string): void {
    const label = value.trim();
    if (label) this.settingsChange.emit({ label });
    else this.clear.emit(['label']);
  }
}
