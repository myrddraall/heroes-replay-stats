import { booleanAttribute, Component, input } from '@angular/core';
import { PlayBackground } from '../../scenes/play-background/play-background';

/**
 * The Play screen background on its own, filling the window: nothing else on the page. With
 * `?versusAI` in the address, it shows the vs A.I. look.
 */
@Component({
  selector: 'hrs-play-background-page',
  imports: [PlayBackground],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  /** The `versusAI` query parameter. */
  readonly versusAI = input(false, { transform: booleanAttribute });
}
