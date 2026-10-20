import { Component, inject, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

let next = 0;

/**
 * A section of a properties panel (presentational): a small heading that folds its rows away
 * and back, as a design tool's properties panel groups a thing's settings; where anything in it
 * is set, a reset beside the heading puts it all back. At the top of a panel it is a pod (a box,
 * its heading a bar across its top); inside another section, just its heading and rows.
 */
@Component({
  selector: 'hrs-property-section',
  imports: [MatIcon],
  templateUrl: './property-section.html',
  styleUrl: './property-section.scss',
  host: { '[class.pod]': '!nested' },
})
export class PropertySection {
  /** Whether it is inside another section (the one it is in, above it in the tree of injectors). */
  protected readonly nested = inject(PropertySection, { optional: true, skipSelf: true }) !== null;
  readonly title = input.required<string>();
  /** Whether it starts unfolded. */
  readonly open = input(true);
  /** Whether anything in it is set here (a reset shows in its heading). */
  readonly changed = input(false);
  /** Its reset was pressed: everything in it back to what it would be. */
  readonly resetRequested = output<void>();
  protected readonly id = `property-section-${next++}`;
  protected readonly folded = signal<boolean | null>(null);

  protected isOpen(): boolean {
    return this.folded() ?? this.open();
  }

  protected toggle(): void {
    this.folded.set(!this.isOpen());
  }
}
