import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { CreatedShape } from '../../../scenes/play-background/created-overlays';
import { PropertySection } from '../properties/property-section';

/** Each shape a part may take, as offered to add: its name and icon. */
const SHAPES: Readonly<Record<CreatedShape, { readonly label: string; readonly icon: string }>> = {
  sphere: { label: 'Sphere', icon: 'circle' },
  ring: { label: 'Ring', icon: 'radio_button_unchecked' },
  band: { label: 'Band', icon: 'panorama_horizontal' },
};

/**
 * A section to add a part to an overlay made in the editor (presentational): one button for each
 * shape it may take (a planet's overlay: a sphere or a ring about the body; the sky's: a band).
 */
@Component({
  selector: 'hrs-add-part',
  imports: [MatIcon, PropertySection],
  templateUrl: './add-part.html',
  styleUrl: './properties-panel.scss',
})
export class AddPart {
  readonly shapes = input.required<readonly CreatedShape[]>();
  readonly added = output<CreatedShape>();
  protected readonly named = SHAPES;
}
