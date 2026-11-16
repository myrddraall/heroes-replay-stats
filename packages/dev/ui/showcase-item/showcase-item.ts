import { Component, input } from '@angular/core';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';

/**
 * One thing in a showcase row, its caption under it (its state, its size). In a `theme` (a
 * team's), the thing is in it and its caption in its bright style.
 */
@Component({
  selector: 'hrs-showcase-item',
  imports: [StyledText],
  templateUrl: './showcase-item.html',
  styleUrl: './showcase-item.scss',
  host: { '[attr.theme]': 'theme()' },
})
export class ShowcaseItem {
  readonly caption = input.required<string>();
  /** The theme it is in; none, its row's. */
  readonly theme = input<string | null>(null);
}
