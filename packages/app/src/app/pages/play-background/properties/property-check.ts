import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/** A setting on or off on one short row of a properties panel (presentational): a checkbox and its label. */
@Component({
  selector: 'hrs-property-check',
  imports: [MatIcon],
  templateUrl: './property-check.html',
  styleUrl: './property-check.scss',
})
export class PropertyCheck {
  readonly label = input.required<string>();
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  readonly checked = input.required<boolean>();
  readonly checkedChange = output<boolean>();
  protected readonly id = `property-check-${next++}`;

  protected update(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
