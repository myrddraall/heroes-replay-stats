import { DatePipe, PercentPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import type { PlayerRow } from '../players-table/players-table.presenter';

/**
 * Who a player's page is about (presentational): their name and region, whether they are you, and
 * their matches, record and last match as named lines.
 */
@Component({
  selector: 'hrs-player-card',
  imports: [DatePipe, PercentPipe],
  templateUrl: './player-card.html',
  styleUrl: './player-card.scss',
})
export class PlayerCard {
  readonly player = input.required<PlayerRow>();
}
