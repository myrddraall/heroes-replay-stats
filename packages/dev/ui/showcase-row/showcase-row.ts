import { Component, input } from '@angular/core';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';

/**
 * A row of a showcase: its label, then what it shows (`hrs-showcase-item`s or the things
 * themselves). In a `theme` (a team's), what it shows is in it and its label in its bright style.
 */
@Component({
  selector: 'hrs-showcase-row',
  imports: [StyledText],
  templateUrl: './showcase-row.html',
  styleUrl: './showcase-row.scss',
  host: { '[attr.theme]': 'theme()' },
})
export class ShowcaseRow {
  readonly label = input.required<string>();
  /** The theme it is in; none, the page's. */
  readonly theme = input<string | null>(null);
}
