import { Component, input, output, inject } from '@angular/core';
import { OVERRIDE_SHOWN } from './override-shown';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/** A setting on or off on one short row of a properties panel (presentational): a checkbox and its label. */
@Component({
  selector: 'forge-property-check',
  host: { '[class.row--overridden]': '!!overridden()' },
  imports: [MatIcon],
  templateUrl: './property-check.html',
  styleUrl: './property-check.scss',
})
export class PropertyCheck {
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
  readonly checked = input.required<boolean>();
  readonly checkedChange = output<boolean>();
  protected readonly id = `property-check-${next++}`;

  protected update(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
