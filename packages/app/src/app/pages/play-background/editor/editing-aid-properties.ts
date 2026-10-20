import { Component, input, output } from '@angular/core';
import { PropertyColour } from '../properties/property-colour';
import { PropertySection } from '../properties/property-section';
import { type PropertyOption, PropertySelect } from '../properties/property-select';

/** An aid's properties as shown: its fill, its colour, its grid's size. */
export interface EditingAidValues {
  readonly fill: string;
  /** The sky, where the fill is one (the backdrop's). */
  readonly sky?: string;
  readonly colour: string;
  readonly gridSize: string;
}

/** Which of an aid's properties differ from how it starts. */
export type EditingAidChanged = Readonly<Record<keyof EditingAidValues, boolean>>;

const SIZES: readonly PropertyOption[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/**
 * An editing aid's properties (presentational): the preview stage's backdrop (a sky, chosen here;
 * a colour; or a transparency grid) or the stand-in planet (a colour or the grid; its lights are
 * tree rows of their own).
 */
@Component({
  selector: 'hrs-editing-aid-properties',
  imports: [PropertySection, PropertySelect, PropertyColour],
  templateUrl: './editing-aid-properties.html',
  styleUrl: './properties-panel.scss',
})
export class EditingAidProperties {
  readonly title = input.required<string>();
  readonly fills = input.required<readonly PropertyOption[]>();
  /** The skies there are to choose from, where the fill is a sky. */
  readonly skies = input<readonly PropertyOption[]>([]);
  readonly values = input.required<EditingAidValues>();
  readonly changed = input.required<EditingAidChanged>();
  readonly valuesChange = output<Partial<EditingAidValues>>();
  /** Properties to put back as they start. */
  readonly clear = output<readonly (keyof EditingAidValues)[]>();
  protected readonly sizes = SIZES;
}
