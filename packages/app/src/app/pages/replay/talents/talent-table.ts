import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { PlayerCell } from '../player-cell';
import { TALENT_TIERS, type TalentRow } from './talent-rows';

/**
 * A replay's talents (presentational): one row per player, coloured from your point of view, and
 * the talent they picked at each tier, with its icon.
 */
@Component({
  selector: 'hrs-talent-table',
  imports: [NgOptimizedImage, PlayerCell],
  templateUrl: './talent-table.html',
  styleUrl: './talent-table.scss',
})
export class TalentTable {
  readonly rows = input.required<readonly TalentRow[]>();
  protected readonly tiers = TALENT_TIERS;
}
