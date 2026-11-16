import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PropertySection } from '../controls/property-section';
import { PropertyText } from '../controls/rows/property-text';

/** A variant as a list of them shows it: its id, name, whether it is on, whether it can be deleted. */
export interface VariantRow {
  readonly id: string;
  readonly name: string;
  readonly on: boolean;
  readonly removable: boolean;
}

/**
 * Variants (presentational): a body's own, or a scene's, each switched on or off (`toggled`),
 * opened to be edited (`edit`: what is set then goes into it; opened again, back to its owner's
 * own), renamed while it is open, and deleted where it can be; new ones made, from nothing or
 * (where offered) from what is set on its owner (`fromChanges`). Its reset puts which are on back.
 */
@Component({
  selector: 'forge-variant-list',
  imports: [MatIcon, PropertySection, PropertyText],
  templateUrl: './variant-list.html',
  styleUrls: [
    '../panel/properties-panel.scss',
    '../controls/added-list.scss',
    './variant-list.scss',
  ],
})
export class VariantList {
  readonly title = input('Variants');
  readonly rows = input.required<readonly VariantRow[]>();
  /** The variant open to be edited, if one is. */
  readonly edited = input<string | null>(null);
  /** Whether which are on is set here (a reset shows). */
  readonly changed = input(false);
  /** Whether variants can be made, opened and deleted here (else only switched on or off). */
  readonly editable = input(true);
  /** Whether a variant can be made of what is set on its owner. */
  readonly fromChangesOffered = input(false);
  readonly toggled = output<{ readonly id: string; readonly on: boolean }>();
  readonly edit = output<string | null>();
  readonly renamed = output<{ readonly id: string; readonly name: string }>();
  readonly removed = output<string>();
  readonly created = output<void>();
  readonly fromChanges = output<void>();
  readonly resetRequested = output<void>();

  protected open(id: string): void {
    this.edit.emit(this.edited() === id ? null : id);
  }
}
