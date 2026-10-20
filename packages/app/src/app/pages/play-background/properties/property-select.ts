import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** A line between the choices, setting groups of them apart. */
export const DIVIDER = { divider: true } as const;

/**
 * A choice: its value, and what is shown for it (the value itself where only a string is given);
 * or a divider between groups of them.
 */
export type PropertyOption =
  string | { readonly value: string; readonly label: string } | typeof DIVIDER;

/** Groups of choices, a divider between each two (empty groups left out). */
export function grouped(...groups: readonly (readonly PropertyOption[])[]): PropertyOption[] {
  return groups.filter((g) => g.length).flatMap((g, i) => (i ? [DIVIDER, ...g] : [...g]));
}

let next = 0;

/** A choice from a short list on one short row of a properties panel (presentational). */
@Component({
  selector: 'hrs-property-select',
  imports: [MatIcon],
  templateUrl: './property-select.html',
  styleUrl: './property-select.scss',
})
export class PropertySelect {
  readonly label = input.required<string>();
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Where its value comes from where it isn't set here (a level under the one edited), if anywhere. */
  readonly origin = input<string>();
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  readonly value = input.required<string>();
  readonly options = input.required<readonly PropertyOption[]>();
  readonly valueChange = output<string>();
  protected readonly id = `property-select-${next++}`;
  /** The choices as shown: each with its value and label, or a divider (no value). */
  protected readonly choices = computed(() =>
    this.options().map((o, i) =>
      typeof o === 'string'
        ? { key: o, value: o, label: o }
        : 'divider' in o
          ? { key: `divider-${i}`, value: null, label: '' }
          : { key: o.value, ...o },
    ),
  );

  protected update(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
