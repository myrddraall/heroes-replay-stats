import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { Component, input } from '@angular/core';
import { CellTemplate, DataGrid, GridColumn } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { PlayerCell } from '../player-cell/player-cell';
import { TALENT_TIERS, type TalentRow } from './talent-rows';

/**
 * A replay's talents (presentational, on the data grid): one row per player, coloured from your point of view, and
 * the talent they picked at each tier, with its icon.
 */
@Component({
  selector: 'hrs-talent-table',
  imports: [CellTemplate, DataGrid, GridColumn, PlayerCell, Sprite],
  templateUrl: './talent-table.html',
  styleUrl: './talent-table.scss',
})
export class TalentTable {
  readonly rows = input.required<readonly TalentRow[]>();
  protected readonly tiers = TALENT_TIERS;
  protected readonly byKey = (row: TalentRow) => row.key;
  protected readonly themeOf = (row: TalentRow) => row.theme ?? null;
}
