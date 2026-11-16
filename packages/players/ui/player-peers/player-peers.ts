import { DatePipe, PercentPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import {
  CellTemplate,
  DataGrid,
  GridColumn,
  GridHeader,
  GridRowElement,
  RowTemplate,
} from '@myrddraall/heroes-replay-stats-data-views/ui';
import type { PlayerPeer } from '../../model';

/**
 * The people a player shared matches with on one side, their team's or the other's (presentational,
 * on the data grid): how many matches, and the player's own record in them. Each opens that
 * person's page.
 */
@Component({
  selector: 'hrs-player-peers',
  imports: [
    CellTemplate,
    DataGrid,
    DatePipe,
    EmptyState,
    GridColumn,
    GridHeader,
    GridRowElement,
    PercentPipe,
    RouterLink,
    RowTemplate,
  ],
  templateUrl: './player-peers.html',
  styleUrl: './player-peers.scss',
})
export class PlayerPeers {
  /** What these people are to the player: `Teammates`, `Opponents`. */
  readonly title = input.required<string>();
  /** What the record in their matches is called: the player's with them, or against them. */
  readonly recordLabel = input.required<string>();
  readonly peers = input.required<readonly PlayerPeer[]>();

  protected readonly byId = (peer: PlayerPeer) => peer.id;
}
