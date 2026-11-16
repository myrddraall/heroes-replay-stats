import { Component, input } from '@angular/core';
import { GameText } from '../game-text/game-text';

/**
 * A talent's tooltip content, as the game's (StandardTooltip's TalentTooltipTemplate): its name as
 * the header (StandardTooltipHeader: light blue to white, glowing blue), a details line under it
 * (StandardTooltipDetails; the game's costs and cooldown, here the level it was picked at), then its
 * full text in the game's markup. 450 wide, as the game's. Inside `hrsTooltip`'s panel.
 */
@Component({
  selector: 'hrs-talent-tooltip',
  imports: [GameText],
  templateUrl: './talent-tooltip.html',
  styleUrl: './talent-tooltip.scss',
})
export class TalentTooltip {
  readonly name = input.required<string>();
  /** The details line (`Level 10`); none where empty. */
  readonly details = input('');
  /** The full text, in the game's markup; none before the data has it. */
  readonly text = input<string | null>(null);
}
