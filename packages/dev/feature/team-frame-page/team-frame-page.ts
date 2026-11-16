import { Component } from '@angular/core';
import { CircleFrame, HexFrame, SquareFrame, TeamLogo } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { SHOWCASE_SIZES } from '../../model';
import { Showcase, ShowcaseItem, ShowcaseRow } from '../../ui';

/**
 * A team in the shaped frames, and its logo alone, the UI area's Components › Frames › Team frame
 * (`/ui/components/frames/team`): each team's, plain and lit, framed (hex, flat and pointy; circle;
 * square) and alone, and at a few sizes.
 */
@Component({
  selector: 'hrs-team-frame-page',
  imports: [CircleFrame, HexFrame, Layout, Showcase, ShowcaseItem, ShowcaseRow, SquareFrame, TeamLogo],
  templateUrl: './team-frame-page.html',
  styleUrl: './team-frame-page.scss',
})
export class TeamFramePage {
  protected readonly sizes = SHOWCASE_SIZES;
  /** Each team's theme, plain and lit. */
  protected readonly looks = [
    { theme: 'blue', lit: false, label: 'blue' },
    { theme: 'blue', lit: true, label: 'blue, lit' },
    { theme: 'red', lit: false, label: 'red' },
    { theme: 'red', lit: true, label: 'red, lit' },
  ];
}
