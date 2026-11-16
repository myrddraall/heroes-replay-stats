import { Component } from '@angular/core';

/**
 * A score row's bar, as the game's row texture draws it (Storm_UI_ScoreScreen_Stats_PlayerBG): 4px
 * of the row's light colour its full height, 8px in, the left corners cut at 45° over 4px, and a
 * glow following that shape (a drop shadow): 55% of the mid grey at the bar fading out over about
 * 8px, into the gaps and past the ends. Placed in its row (which `_score-row.scss`'s `texture`
 * positions), behind the row's content, in the row's --score-row-bar and --score-row-glow.
 */
@Component({
  selector: 'ui-score-row-bar',
  template: `<svg aria-hidden="true" focusable="false">
    <polygon points="4,0 4,4 0,4" />
    <rect class="middle" x="0" y="4" width="4" />
    <svg y="100%" overflow="visible"><polygon points="0,-4 4,-4 4,0" /></svg>
  </svg>`,
  styles: `
    :host {
      position: absolute;
      top: 0;
      left: 8px;
      z-index: -1;
      width: 4px;
      height: 100%;
      pointer-events: none;
      filter: drop-shadow(0 0 2px var(--score-row-glow))
        drop-shadow(0 0 5px oklch(from var(--score-row-glow) l c h / 0.5));
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      fill: var(--score-row-bar);
    }

    .middle {
      height: calc(100% - 8px);
    }
  `,
})
export class ScoreRowBar {}
