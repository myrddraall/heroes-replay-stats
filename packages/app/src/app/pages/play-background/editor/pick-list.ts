import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PropertySection } from '../properties/property-section';
import { type AddedItem, AddedList } from './added-list';

/** A thing to pick, as the list shows it: its value (an id, a name), and how it is named. */
export interface PickChoice {
  readonly value: string;
  readonly label: string;
}

let next = 0;

/**
 * A section to pick things (presentational), as any section that adds things is: a list to pick
 * another from (those not picked yet) and, where given (`newLabel`), a button to make a new one;
 * under them, in a section of its own, what is picked, in order, each by name with a button to take
 * it out and, where `linkable`, one to go to it in the tree. What is picked is set at the level
 * edited where `changed` (its reset: back to what is under it).
 */
@Component({
  selector: 'hrs-pick-list',
  imports: [PropertySection, MatIcon, AddedList],
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
  /** Material Symbols' name for what is picked. */
  readonly icon = input('label');
  /** Whether what is picked can be gone to in the tree (`itemShow`), and what doing so is called. */
  readonly linkable = input(false);
  readonly linkLabel = input('Show in the tree');
  /** What making a new one is called (none: no button to). */
  readonly newLabel = input('');
  readonly added = output<string>();
  readonly itemShow = output<string>();
  readonly created = output<void>();
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
  /** What is picked, as its list shows it (by value). */
  protected readonly items = computed((): AddedItem[] =>
    this.shown().map((p) => ({ key: p.value, label: p.label, icon: this.icon(), removable: true })),
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
