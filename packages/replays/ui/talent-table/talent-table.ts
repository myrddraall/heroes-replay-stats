import { Component, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { CellTemplate, DataGrid, GridColumn, HeaderTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { TalentFrame } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { ScoreRowBar } from '../stat-tables/score-row/score-row-bar';
import { ScoreRowHead } from '../stat-tables/score-row/score-row-head';
import { ScoreTeams } from '../stat-tables/score-teams/score-teams';
import type { ScoreScreenTeamRow } from '@myrddraall/heroprotocol-analysis';
import { HEROIC_TALENT_TIER, TALENT_TIER_LEVELS, TALENT_TIERS, type TalentRow } from './talent-rows';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';

/**
 * A replay's talents (presentational), as the game's talent screen (TalentsOverviewPanel) in the
 * score screen's look: one card, a score row per player (its row head the score screen's), coloured
 * from your point of view, your own row in your side's self theme, and the talent each picked at
 * each tier in the game's talent frame (heroic or not, picked or empty), centred in the tier's
 * column under the level it opens at, its name and level in its tooltip and alt text; the teams'
 * totals across the bottom.
 */
@Component({
  selector: 'hrs-talent-table',
  imports: [CellTemplate, DataGrid, GridColumn, HeaderTemplate, MatTooltip, ScoreRowBar, ScoreRowHead, ScoreTeams, StyledText, TalentFrame],
  templateUrl: './talent-table.html',
  styleUrl: './talent-table.scss',
})
export class TalentTable {
  readonly rows = input.required<readonly TalentRow[]>();
  /** The teams' totals, across the bottom as on the score screen. */
  readonly teams = input.required<readonly ScoreScreenTeamRow[]>();
  protected readonly tiers = TALENT_TIERS;
  protected readonly levels = TALENT_TIER_LEVELS;
  protected readonly heroicTier = HEROIC_TALENT_TIER;
  protected readonly byKey = (row: TalentRow) => row.key;
  protected readonly themeOf = (row: TalentRow) => row.theme ?? null;
}
