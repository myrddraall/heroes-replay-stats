import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PropertySection } from '../properties/property-section';

/** Something added to what is selected (a moon, a part, a light, a planet, a camera), by its tree row. */
export interface AddedItem {
  /** Its row's key in the tree. */
  readonly key: string;
  readonly label: string;
  /** Material Symbols' name for what it is. */
  readonly icon: string;
  /** A quieter word beside its name (a group, the primary camera). */
  readonly detail?: string;
  /** Whether it can be taken out here. */
  readonly removable: boolean;
}

/** What has been added to what is selected, by where it was added. */
export interface AddedLists {
  readonly planets?: readonly AddedItem[];
  readonly moons?: readonly AddedItem[];
  readonly parts?: readonly AddedItem[];
  readonly cameras?: readonly AddedItem[];
  readonly lights?: readonly AddedItem[];
}

/**
 * What has been added under the section that adds it (presentational): a section of its own
 * inside that one, each thing a row with a way to go to it in the tree (`itemShow`) and, where it
 * can be, to take it out (`itemRemove`), by its key. Nothing added: nothing shown.
 */
@Component({
  selector: 'hrs-added-list',
  imports: [MatIcon, PropertySection],
  templateUrl: './added-list.html',
  styleUrls: ['./properties-panel.scss', './added-list.scss'],
})
export class AddedList {
  readonly title = input.required<string>();
  readonly items = input.required<readonly AddedItem[]>();
  /** Whether each can be gone to in the tree, and what doing so (and taking one out) is called. */
  readonly linkable = input(true);
  readonly linkLabel = input('Select in the tree');
  readonly removeLabel = input('Remove');
  readonly itemShow = output<string>();
  readonly itemRemove = output<string>();
}
