import { Component, input } from '@angular/core';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import type { StatIcon as StatIconPictures } from '../../../model';

/**
 * A stat's game icon (presentational), as the game's score screen draws its sort buttons: normal,
 * sorted by (`sorted`), or hovered. Hover is its container's (a header, a chip): it sets
 * `--stat-icon-normal: none; --stat-icon-hover: block` while hovered. 1em square, so `font-size`
 * sizes it. Decorative: its container names the stat.
 */
@Component({
  selector: 'ui-stat-icon',
  imports: [Sprite],
  templateUrl: './stat-icon.html',
  styleUrl: './stat-icon.scss',
  host: { 'aria-hidden': 'true' },
})
export class StatIcon {
  readonly icon = input.required<StatIconPictures>();
  readonly sorted = input(false);
}
