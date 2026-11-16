import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, Component, input } from '@angular/core';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';

/**
 * The game's logo (presentational), as the official site draws it (heroes-of-the-storm.svg): its
 * hexagon with the swirl's three blades cut out, a quarter turn so it lies flat at top and bottom,
 * in the theme's styled text: `base` (the theme's accent), or `bright` while `lit` (a white core in
 * the theme's glow). A container lights it without an input by setting `--team-logo-base: hidden`
 * and `--team-logo-bright: visible` on it (a row while hovered).
 *
 * Its `shape`: `hexagon`, the logo alone, its hexagon 1em high at its `font-size`; or `square`, to
 * put in a shaped frame (`hrs-hex-frame`, `hrs-circle-frame`, `hrs-square-frame`) as a portrait
 * is: the blades cut out of a square filling the frame's inside, which cuts it to its shape, the
 * blades a little smaller in it (0.85) than in the logo's hexagon of the inside's height.
 */
@Component({
  selector: 'hrs-team-logo',
  imports: [NgTemplateOutlet, StyledText],
  templateUrl: './team-logo.html',
  styleUrl: './team-logo.scss',
  host: {
    'aria-hidden': 'true',
    '[class.lit]': 'lit()',
    '[class.square]': "shape() === 'square'",
  },
})
export class TeamLogo {
  /** In the bright style, as the game lights it. */
  readonly lit = input(false, { transform: booleanAttribute });
  /** The logo's hexagon, or a square to fill a frame's inside. */
  readonly shape = input<'hexagon' | 'square'>('hexagon');

  /** The logo's hexagon, in the drawing's units. */
  protected readonly hexagon = 'M41.93 13.863v20.84L23.965 45.121 6 34.702v-20.84L23.965 3.444z';
  /**
   * A square about the hexagon's centre, three times the drawing's, so it fills a frame's inside
   * however small the drawing is drawn in it.
   */
  protected readonly square = 'M-48.035 -47.717h144v144h-144z';
  /** The swirl's three blades, cut out of either. */
  protected readonly blades =
    'M9.593 22.306c1.078-9.7 9.522-12.216 9.522-12.216C7.976 22.127 21.27 30.57 21.27 30.57l-8.982 1.976c.18 0-3.054-3.772-2.695-10.24 M29.894 37.577c-9.522 3.593-15.091-2.515-15.091-2.515 15.63 3.952 16.707-12.037 16.707-12.037l5.929 7.006s-1.617 4.85-7.546 7.546 M38.337 26.618c-4.67-15.63-18.145-8.084-18.145-8.084l2.875-9.162s5.749-.719 10.958 3.772c6.288 5.39 4.312 13.474 4.312 13.474';
}
