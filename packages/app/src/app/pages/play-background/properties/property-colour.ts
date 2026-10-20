import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/** A colour on one short row of a properties panel (presentational): a swatch to pick from, and its hex. */
@Component({
  selector: 'hrs-property-colour',
  imports: [MatIcon],
  templateUrl: './property-colour.html',
  styleUrl: './property-colour.scss',
})
export class PropertyColour {
  readonly label = input.required<string>();
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Where its value comes from where it isn't set here (a level under the one edited), if anywhere. */
  readonly origin = input<string>();
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  /** `#rrggbb`. */
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
  protected readonly id = `property-colour-${next++}`;

  protected picked(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected typed(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) this.valueChange.emit(value.toLowerCase());
  }
}
