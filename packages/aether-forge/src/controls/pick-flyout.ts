import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** A thing to pick: its id, its name, and what it is. */
export interface PickItem {
  readonly id: string;
  readonly label: string;
  readonly caption?: string;
}

/**
 * A flyout to pick one thing from a list (presentational): its title, a filter over the list (by
 * name, or what a thing is), the list scrolling under it; a click picks.
 */
@Component({
  selector: 'forge-pick-flyout',
  imports: [MatIcon, A11yModule],
  templateUrl: './pick-flyout.html',
  styleUrl: './pick-flyout.scss',
  host: { role: 'dialog', '[attr.aria-label]': 'title()', '(keydown.escape)': 'closed.emit()' },
})
export class PickFlyout {
  readonly title = input.required<string>();
  /** Material Symbols' name for the things listed. */
  readonly icon = input('');
  readonly items = input.required<readonly PickItem[]>();
  readonly picked = output<string>();
  readonly closed = output<void>();
  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q
      ? this.items().filter(
          (t) => t.label.toLowerCase().includes(q) || !!t.caption?.toLowerCase().includes(q),
        )
      : this.items();
  });

  protected filtered(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
