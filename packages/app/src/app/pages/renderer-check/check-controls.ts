import { Component, input, output } from '@angular/core';

/** The renderer check's controls and what it is doing (presentational). */
@Component({
  selector: 'hrs-check-controls',
  templateUrl: './check-controls.html',
  styleUrl: './check-controls.scss',
})
export class CheckControls {
  readonly phase = input.required<'idle' | 'running' | 'done'>();
  readonly step = input<string | null>(null);
  /** Whether there are results to copy (as they come, the run going on or not). */
  readonly hasResults = input(false);
  /** The copy button's words: what it does, or what came of it. */
  readonly copyLabel = input('Copy results');
  readonly start = output();
  readonly copyResults = output();
}
