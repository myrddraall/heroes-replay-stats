import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PropertySection } from '../properties/property-section';

/** A thing to pick, as the list shows it: its value (an id, a name), and how it is named. */
export interface PickChoice {
  readonly value: string;
  readonly label: string;
}

let next = 0;

/**
 * A section listing what is picked (presentational), in order: each by name with a button to take
 * it out, and a list to pick another from (those not picked yet). What is picked is set at the
 * level edited where `changed` (its reset: back to what is under it).
 */
@Component({
  selector: 'hrs-pick-list',
  imports: [PropertySection, MatIcon],
  templateUrl: './pick-list.html',
  styleUrls: ['./properties-panel.scss', './pick-list.scss'],
})
export class PickList {
  readonly title = input.required<string>();
  /** What is picked, in order, by value. */
  readonly picked = input.required<readonly string[]>();
  /** What there is to pick, by value and name. */
  readonly choices = input.required<readonly PickChoice[]>();
  /** What the list to pick another from first says (its own row's label is Add). */
  readonly placeholder = input('Choose…');
  /** What taking one out is called, before its name (for its button's label). */
  readonly removeLabel = input('Remove');
  /** Whether what is picked is set here (else what is under it). */
  readonly changed = input(false);
  readonly added = output<string>();
  readonly removed = output<string>();
  readonly resetRequested = output<void>();
  protected readonly id = `pick-list-${next++}`;
  /** What is picked, by name (one no longer there to pick: its value). */
  protected readonly shown = computed(() =>
    this.picked().map(
      (value): PickChoice =>
        this.choices().find((c) => c.value === value) ?? { value, label: value },
    ),
  );
  /** What isn't picked yet. */
  protected readonly others = computed(() =>
    this.choices().filter((c) => !this.picked().includes(c.value)),
  );

  protected add(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) this.added.emit(select.value);
    select.value = '';
  }
}
