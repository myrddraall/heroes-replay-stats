import { Component, input, output, inject } from '@angular/core';
import { OVERRIDE_SHOWN } from './override-shown';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/** A line of text on one short row of a properties panel (presentational), given when it is left or Enter is pressed. */
@Component({
  selector: 'hrs-property-text',
  host: { '[class.row--overridden]': '!!overridden()' },
  imports: [MatIcon],
  templateUrl: './property-text.html',
  styleUrl: './property-text.scss',
})
export class PropertyText {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  /** What shows in it while it is empty. */
  readonly placeholder = input('');
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Where its value comes from where it isn't set here (a level under the one edited), if anywhere. */
  readonly origin = input<string>();
  /** The level over the one edited that wins for it, if one does (marked so, and shown when its mark is pressed). */
  readonly overridden = input<string>();
  protected readonly showOverride = inject(OVERRIDE_SHOWN, { optional: true });
  readonly resetRequested = output<void>();
  readonly valueChange = output<string>();
  protected readonly id = `property-text-${next++}`;

  protected given(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value !== this.value()) this.valueChange.emit(value);
  }
}
