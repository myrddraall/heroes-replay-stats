import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/**
 * A number set on one short row of a properties panel (presentational): its label, a slider that
 * reports as it is dragged, and the number itself to read or type.
 */
@Component({
  selector: 'hrs-property-slider',
  imports: [MatIcon],
  templateUrl: './property-slider.html',
  styleUrl: './property-slider.scss',
})
export class PropertySlider {
  readonly label = input.required<string>();
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  readonly value = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input(0.01);
  /** The user moved or typed it. */
  readonly valueChange = output<number>();
  protected readonly id = `property-slider-${next++}`;
  /** Decimals to show: the step's. */
  protected readonly decimals = computed(() => {
    const s = String(this.step());
    return s.includes('.') ? s.split('.')[1]!.length : 0;
  });
  protected readonly shown = computed(() => this.value().toFixed(this.decimals()));

  protected update(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(value)) return;
    this.valueChange.emit(Math.min(this.max(), Math.max(this.min(), value)));
  }
}
