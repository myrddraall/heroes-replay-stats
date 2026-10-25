import { Component, input, output, inject } from '@angular/core';
import { OVERRIDE_SHOWN } from './override-shown';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/** A colour on one short row of a properties panel (presentational): a swatch to pick from, and its hex. */
@Component({
  selector: 'hrs-property-colour',
  host: { '[class.row--overridden]': '!!overridden()' },
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
  /** The level over the one edited that wins for it, if one does (marked so, and shown when its mark is pressed). */
  readonly overridden = input<string>();
  protected readonly showOverride = inject(OVERRIDE_SHOWN, { optional: true });
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
