import { Component, computed, input, output, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatIcon } from '@angular/material/icon';

/** A scene a new one can start from: its id, how it is named, what it shows. */
export interface SceneTemplate {
  readonly id: string;
  readonly label: string;
  readonly shows: string;
}

/**
 * The flyout a new scene is made from (presentational): a name for it, and where it starts:
 * empty, or from a scene (any of them, the presets first, in the order given), each a choice to
 * click. The name and empty stay put; the scenes scroll under a filter (by name, or what it shows).
 */
@Component({
  selector: 'forge-new-scene-flyout',
  imports: [MatIcon, A11yModule],
  templateUrl: './new-scene-flyout.html',
  styleUrl: './new-scene-flyout.scss',
  host: { role: 'dialog', 'aria-label': 'New scene', '(keydown.escape)': 'closed.emit()' },
})
export class NewSceneFlyout {
  readonly templates = input.required<readonly SceneTemplate[]>();
  /** A scene to make: from a template (none: empty), named (none: as it starts). */
  readonly create = output<{ readonly from?: string; readonly name: string }>();
  readonly closed = output<void>();
  protected readonly name = signal('');
  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q
      ? this.templates().filter(
          (t) => t.label.toLowerCase().includes(q) || t.shows.toLowerCase().includes(q),
        )
      : this.templates();
  });

  protected named(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected filtered(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
