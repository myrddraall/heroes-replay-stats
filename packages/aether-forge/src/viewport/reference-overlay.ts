import { Component, computed, input } from '@angular/core';
import type { ReferenceMode } from '../aids/editing-aids.store';

/**
 * The reference image over the view (presentational): as tall as the view times `scale` (the
 * view's camera keeps its height's angle, so a screenshot of the game's screen fits by its
 * height), its middle moved `across` and `up` by shares of the view; shown right of a line
 * `amount` across the view (split), or at `amount`'s opacity over it all (fade). It takes no
 * pointer: what is under it is still clicked.
 */
@Component({
  selector: 'forge-reference-overlay',
  templateUrl: './reference-overlay.html',
  styleUrl: './reference-overlay.scss',
  host: { 'aria-hidden': 'true' },
})
export class ReferenceOverlay {
  readonly url = input.required<string>();
  readonly mode = input.required<ReferenceMode>();
  readonly amount = input.required<number>();
  readonly scale = input.required<number>();
  readonly across = input.required<number>();
  readonly up = input.required<number>();

  protected readonly clip = computed(() =>
    this.mode() === 'split' ? `inset(0 0 0 ${this.amount() * 100}%)` : 'none',
  );
  protected readonly opacity = computed(() => (this.mode() === 'fade' ? this.amount() : 1));
}
