import { Component, input, output } from '@angular/core';
import type { GroupPlacement, Vec3 } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { PropertyNumber } from '../controls/rows/property-number';
import { PropertySection } from '../controls/property-section';
import { PropertyText } from '../controls/rows/property-text';

/**
 * A group put in a scene, as its properties show it (presentational): its name there (the group's
 * own under it), where its middle is (across, up, distance), how big and how turned; a way to open
 * the group itself (what is in it is set there), and to take it out of the scene.
 */
@Component({
  selector: 'forge-group-placement-properties',
  imports: [PropertySection, PropertyNumber, PropertyText],
  templateUrl: './group-placement-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class GroupPlacementProperties {
  readonly placement = input.required<GroupPlacement>();
  /** The group's own name (what its name here falls back to). */
  readonly groupName = input.required<string>();
  readonly placementChange = output<Partial<GroupPlacement>>();
  readonly editRequested = output<void>();
  readonly removeRequested = output<void>();

  /** Its middle moved along one axis (0 across, 1 away, 2 up). */
  protected move(axis: 0 | 1 | 2, value: number): void {
    const position: [number, number, number] = [...this.placement().position] as [
      number,
      number,
      number,
    ];
    position[axis] = value;
    this.placementChange.emit({ position: position as Vec3 });
  }
}
