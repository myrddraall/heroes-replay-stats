import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { CreatedShape } from '../../../scenes/play-background/created-overlays';
import { PropertySection } from '../properties/property-section';
import type { PickChoice } from './pick-list';

/** Each shape a part may take, as offered to add: its name and icon. */
const SHAPES: Readonly<Record<CreatedShape, { readonly label: string; readonly icon: string }>> = {
  sphere: { label: 'Sphere', icon: 'circle' },
  ring: { label: 'Ring', icon: 'radio_button_unchecked' },
  band: { label: 'Band', icon: 'panorama_horizontal' },
};

let next = 0;

/**
 * A section to add parts (presentational) to what is selected: a body, a sky, an overlay made in
 * the editor. One button for each new shape it may take (a planet's: a sphere or a ring about the
 * body; the sky's: a band), a list of the game data's parts to reuse (`existing`), and, where what
 * was added here may be (`savable`), a button to save it as an overlay.
 */
@Component({
  selector: 'hrs-add-part',
  imports: [MatIcon, PropertySection],
  templateUrl: './add-part.html',
  styleUrls: ['./properties-panel.scss', './add-part.scss'],
})
export class AddPart {
  readonly shapes = input.required<readonly CreatedShape[]>();
  readonly existing = input<readonly PickChoice[]>([]);
  readonly savable = input(false);
  readonly added = output<CreatedShape>();
  readonly reused = output<string>();
  readonly saved = output<void>();
  protected readonly named = SHAPES;
  protected readonly id = `add-part-${next++}`;

  protected reuse(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) this.reused.emit(select.value);
    select.value = '';
  }
}
