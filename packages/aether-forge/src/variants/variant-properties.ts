import { Component, input, output } from '@angular/core';
import { PropertySection } from '../controls/property-section';
import { PropertyCheck } from '../controls/rows/property-check';
import { PropertyText } from '../controls/rows/property-text';
import type { VariantRow } from './variant-list';

/**
 * One of a body's variants, as its properties show it (presentational): whether it is on; where
 * variants are made here (a planet's, in the library), its name, opening it to be edited (what is
 * set then goes into it; opened again, back to its owner's own), and deleting it where it can be.
 */
@Component({
  selector: 'forge-variant-properties',
  imports: [PropertySection, PropertyCheck, PropertyText],
  templateUrl: './variant-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class VariantProperties {
  readonly variant = input.required<VariantRow>();
  /** Whether variants can be renamed, opened and deleted here (else only switched on or off). */
  readonly editable = input(false);
  /** Whether it is the variant open to be edited. */
  readonly edited = input(false);
  readonly toggled = output<boolean>();
  readonly renamed = output<string>();
  readonly editToggled = output<void>();
  readonly removed = output<void>();
}
