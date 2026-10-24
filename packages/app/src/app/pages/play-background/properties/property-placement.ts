import { Component, computed, input, output } from '@angular/core';
import {
  atLeast,
  orbitOffset,
  orbitThrough,
  type OrbitPlace,
  overOf,
  overOffset,
  PLACEMENT_MODES,
  type PlacementMode,
} from '../../../scenes/play-background/placement';
import { type Direction, PropertyDirection } from './property-direction';
import { PropertyNumber } from './property-number';
import { PropertySelect } from './property-select';

/** One of the free mode's rows: its label, the axis it sets (0 across, 1 away, 2 up), and which way (-1: towards). */
export interface PlacementAxis {
  readonly label: string;
  readonly axis: 0 | 1 | 2;
  readonly sign: 1 | -1;
}

/** The free mode's rows as a light or a moon has them: across, towards the eye, up. */
export const BODY_AXES: readonly PlacementAxis[] = [
  { label: 'Across', axis: 0, sign: 1 },
  { label: 'Towards', axis: 1, sign: -1 },
  { label: 'Up', axis: 2, sign: 1 },
];

/** A place changed: how it is set, where it is now, and (on an orbit) the orbit it is on. */
export interface PlacementChange {
  readonly mode?: PlacementMode;
  readonly position: Direction;
  readonly orbit: OrbitPlace;
}

/**
 * Where something placed about a body is (presentational; see `PlacementMode`): its Placement
 * (Free, Over a spot, Orbit) and that way's rows. Free: its place along each axis; Over a spot:
 * the spot on the sphere (the direction disc) and its Distance from the middle; Orbit: its
 * Distance, Progress round the orbit, the orbit's Tilt and Turn. Every change gives the place and
 * the orbit through it (its turn kept), so whatever keeps it keeps either; switching the way it is
 * set keeps the place, or, where the way chosen can't come nearer the middle than `least`, the
 * nearest place it can.
 */
@Component({
  selector: 'hrs-property-placement',
  imports: [PropertySelect, PropertyNumber, PropertyDirection],
  templateUrl: './property-placement.html',
  styleUrl: './property-placement.scss',
})
export class PropertyPlacement {
  readonly mode = input.required<PlacementMode>();
  /** Where it is, from the body's middle, in its frame and radii. */
  readonly position = input.required<Direction>();
  /** The turn of the orbit it is on (its plane's, kept as the place moves). */
  readonly turn = input(0);
  /** The orbit it is on, where that is what is kept (shown as kept; none: the one through its place, by its turn). */
  readonly orbitPlace = input<OrbitPlace>();
  /** How near the middle Over a spot and Orbit may put it, in radii. */
  readonly least = input(1);
  /** The free mode's rows. */
  readonly axes = input<readonly PlacementAxis[]>(BODY_AXES);
  /** How finely its distances and free rows step. */
  readonly step = input(0.1);
  /** Whether its place is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Where its place comes from where it isn't set here, if anywhere. */
  readonly origin = input<string>();
  readonly resetRequested = output<void>();
  readonly placeChange = output<PlacementChange>();

  protected readonly modes = PLACEMENT_MODES;
  protected readonly over = computed(() => overOf(this.position()));
  protected readonly orbit = computed(
    () => this.orbitPlace() ?? orbitThrough(this.position(), this.turn()),
  );

  /** Set another way: where it is kept (no nearer than it may be, set so). */
  protected chooseMode(value: string): void {
    const mode = value as PlacementMode;
    const position = mode === 'free' ? this.position() : atLeast(this.position(), this.least());
    this.emit(position, this.turn(), mode);
  }

  /** Moved along one of the free mode's rows. */
  protected move(a: PlacementAxis, value: number): void {
    const position = [...this.position()] as [number, number, number];
    position[a.axis] = value * a.sign;
    this.emit(position, this.turn());
  }

  protected overChange(change: Partial<{ at: Direction; distance: number }>): void {
    this.emit(overOffset({ ...this.over(), ...change }), this.turn());
  }

  protected orbitChange(change: Partial<OrbitPlace>): void {
    const orbit = { ...this.orbit(), ...change };
    this.placeChange.emit({ position: orbitOffset(orbit), orbit });
  }

  private emit(position: Direction, turn: number, mode?: PlacementMode): void {
    this.placeChange.emit({
      ...(mode ? { mode } : {}),
      position,
      orbit: orbitThrough(position, turn),
    });
  }
}
