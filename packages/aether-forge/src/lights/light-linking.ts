import { Component, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { LinkChange, LinkEntry } from './linking';
let next = 0;

/**
 * What a light lights, as its Linking lists it (presentational): its own body, then each other
 * body it reaches (moons under their planet) or group, each checked where it lights it (its own
 * body: always), its parts and materials folded under it, each checked where it reaches it.
 * Checked or not, it is taken in or left out there; one set at the level edited can be reset.
 */
@Component({
  selector: 'forge-light-linking',
  imports: [MatIcon],
  templateUrl: './light-linking.html',
  styleUrl: './light-linking.scss',
})
export class LightLinking {
  readonly links = input.required<readonly LinkEntry[]>();
  readonly linkChange = output<LinkChange>();
  readonly linkReset = output<string>();
  protected readonly id = `light-linking-${next++}`;
  /** Those unfolded to their parts, by key. */
  protected readonly open = signal<ReadonlySet<string>>(new Set());

  protected toggle(key: string): void {
    this.open.update((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected check(change: Omit<LinkChange, 'on'>, event: Event): void {
    this.linkChange.emit({ ...change, on: (event.target as HTMLInputElement).checked });
  }
}
