import { Component, input } from '@angular/core';

/**
 * About the app (presentational): what it does, in plain words, with its version and what it runs
 * as; and the legal notices for the game's trademarks and art, on this one page.
 */
@Component({
  selector: 'hrs-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  /** The app's version. */
  readonly version = input.required<string>();
  /** What the app runs as. */
  readonly kind = input.required<'web' | 'desktop'>();
}
