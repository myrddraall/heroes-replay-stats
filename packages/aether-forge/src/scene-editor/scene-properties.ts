import { Component, input, output } from '@angular/core';
import { PropertySection } from '../controls/property-section';
import { PropertyText } from '../controls/rows/property-text';

/**
 * The scene's own properties (presentational): its name and a way to delete it (a scene of its
 * own: not the random sets'), what may be put in it (its Planets section given as `[planetsPod]`),
 * and, while the sets are up, another set. A group's: as a scene's. (Its colour grading is a
 * category of its own in the tree.)
 */
@Component({
  selector: 'forge-scene-properties',
  imports: [PropertySection, PropertyText],
  templateUrl: './scene-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class SceneProperties {
  /** Whether the random sets are up (another can be drawn). */
  readonly sets = input(false);
  /** Whether planets can be put in it (its Planets section given as `[planetsPod]`). */
  readonly planets = input(false);
  /** Whether it is a scene of its own (named, deletable), not the random sets'. */
  readonly own = input(false);
  /** Whether it is a group (a scene within scenes): named and deleted as one. */
  readonly group = input(false);
  /** Its name ('': none, its planet's id shown). */
  readonly name = input('');
  readonly planet = input('');
  readonly nameChange = output<string>();
  readonly deleteRequested = output<void>();
  readonly anotherSet = output<void>();
}
