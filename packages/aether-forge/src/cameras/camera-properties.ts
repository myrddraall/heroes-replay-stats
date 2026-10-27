import { Component, computed, input, output } from '@angular/core';
import type { CameraPlacement, Vec3 } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { atLeast } from '@myrddraall/heroes-replay-stats-aether/space';
import { PropertyNumber } from '../controls/rows/property-number';
import { type PlacementChange, PropertyPlacement } from '../controls/rows/property-placement';
import { type PropertyOption, PropertySelect } from '../controls/rows/property-select';
import { PropertySection } from '../controls/property-section';
import { PropertyText } from '../controls/rows/property-text';

/** A camera as its panel shows it: where it is, its turn and tilt (degrees), its field of view. */
export interface CameraValues {
  readonly eye: Vec3;
  readonly turn: number;
  readonly tilt: number;
  readonly fovY: number;
}

/** One of a scene's planets a camera may be placed about: its name, where it is, how big. */
export interface CameraPlanet {
  readonly label: string;
  readonly position: Vec3;
  readonly radius: number;
}

/** A camera placed: where it is now, and how its place is set (none: in the scene's own space). */
export interface CameraPlaced {
  readonly eye: Vec3;
  readonly placement?: CameraPlacement;
}

/** The About list's choice for the scene's own space. */
const SCENE = 'scene';

/**
 * One of a scene's cameras, as its properties show it (presentational): its name (one added;
 * the game's is the game's), whether the scene is shown through it and a way to make it so,
 * a way to look through it, to take it out (one added); where it is (in the scene's own space, or
 * about one of its planets, placed one way or another: `PropertyPlacement`) and looks, and its
 * field of view (the game's set back to the data's by its section's reset).
 */
@Component({
  selector: 'forge-camera-properties',
  imports: [PropertySection, PropertyNumber, PropertyText, PropertySelect, PropertyPlacement],
  templateUrl: './camera-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class CameraProperties {
  readonly name = input.required<string>();
  readonly values = input.required<CameraValues>();
  /** Whether it is the game's camera (named so, not taken out; its place set over the data's). */
  readonly game = input(false);
  /** Whether the game's camera is set here (its section's reset puts it back). */
  readonly changed = input(false);
  /** Whether the scene is shown through it. */
  readonly primary = input(false);
  /** Whether the view looks through it now (dragging the view moves it). */
  readonly lookingThrough = input(false);
  /** The scene's planets it may be placed about. */
  readonly planets = input<readonly CameraPlanet[]>([]);
  /** How its place is set (none: in the scene's own space). */
  readonly placement = input<CameraPlacement>();
  readonly placementChange = output<CameraPlaced>();
  readonly nameChange = output<string>();
  readonly cameraChange = output<Partial<CameraValues>>();
  readonly cameraReset = output<void>();
  readonly primaryRequested = output<void>();
  readonly lookRequested = output<void>();
  readonly removeRequested = output<void>();

  /** The planet it is placed about (none: in the scene's own space, or the planet is gone). */
  protected readonly about = computed(() => {
    const p = this.placement();
    return p ? (this.planets()[p.about] ?? null) : null;
  });
  protected readonly aboutValue = computed(() =>
    this.about() ? String(this.placement()!.about) : SCENE,
  );
  protected readonly aboutOptions = computed((): readonly PropertyOption[] => [
    { value: SCENE, label: 'Scene' },
    ...this.planets().map((p, i) => ({ value: String(i), label: p.label })),
  ]);
  /** Where it is from the planet it is placed about, in the planet's radii. */
  protected readonly fromPlanet = computed((): Vec3 => {
    const p = this.about();
    const eye = this.values().eye;
    return p
      ? ([0, 1, 2].map((k) => (eye[k]! - p.position[k]!) / p.radius) as unknown as Vec3)
      : eye;
  });

  /** Placed about a planet (over a spot on it, where it is, or no nearer than its surface), or in the scene's own space. */
  protected chooseAbout(value: string): void {
    const eye = this.values().eye;
    const p = value === SCENE ? undefined : this.planets()[Number(value)];
    if (!p) {
      this.placementChange.emit({ eye });
      return;
    }
    const from = [0, 1, 2].map((k) => (eye[k]! - p.position[k]!) / p.radius) as unknown as Vec3;
    const placement: CameraPlacement = { about: Number(value), mode: 'over' };
    this.placementChange.emit({ eye: this.inScene(p, atLeast(from, 1)), placement });
  }

  /** Placed about its planet: where it is now, how it is set, the turn of the orbit it is on. */
  protected place(change: PlacementChange): void {
    const p = this.about();
    const now = this.placement();
    if (!p || !now) return;
    this.placementChange.emit({
      eye: this.inScene(p, change.position),
      placement: { ...now, mode: change.mode ?? now.mode, turn: change.orbit.turn },
    });
  }

  /** A place about a planet in the scene's space, rounded as a camera's place is kept. */
  private inScene(p: CameraPlanet, from: Vec3): Vec3 {
    return [0, 1, 2].map(
      (k) => Math.round((p.position[k]! + from[k]! * p.radius) * 1000) / 1000,
    ) as unknown as Vec3;
  }

  /** It moved along one axis (0 across, 1 away, 2 up). */
  protected move(axis: 0 | 1 | 2, value: number): void {
    const eye = [...this.values().eye] as [number, number, number];
    eye[axis] = value;
    this.cameraChange.emit({ eye });
  }
}
