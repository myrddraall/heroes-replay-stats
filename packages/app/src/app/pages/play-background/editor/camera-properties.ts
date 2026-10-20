import { Component, input, output } from '@angular/core';
import type { Vec3 } from '../../../scenes/play-background/background-scene';
import { PropertyNumber } from '../properties/property-number';
import { PropertySection } from '../properties/property-section';
import { PropertyText } from '../properties/property-text';

/** A camera as its panel shows it: where it is, its turn and tilt (degrees), its field of view. */
export interface CameraValues {
  readonly eye: Vec3;
  readonly turn: number;
  readonly tilt: number;
  readonly fovY: number;
}

/**
 * One of a scene's cameras, as its properties show it (presentational): its name (one added;
 * the game's is the game's), whether the scene is shown through it and a way to make it so,
 * a way to look through it, to take it out (one added); where it is and looks, and its field of
 * view (the game's set back to the data's by its section's reset).
 */
@Component({
  selector: 'hrs-camera-properties',
  imports: [PropertySection, PropertyNumber, PropertyText],
  templateUrl: './camera-properties.html',
  styleUrl: './properties-panel.scss',
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
  readonly nameChange = output<string>();
  readonly cameraChange = output<Partial<CameraValues>>();
  readonly cameraReset = output<void>();
  readonly primaryRequested = output<void>();
  readonly lookRequested = output<void>();
  readonly removeRequested = output<void>();

  /** It moved along one axis (0 across, 1 away, 2 up). */
  protected move(axis: 0 | 1 | 2, value: number): void {
    const eye = [...this.values().eye] as [number, number, number];
    eye[axis] = value;
    this.cameraChange.emit({ eye });
  }
}
