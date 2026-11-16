import { Component, input, model } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import {
  ScoreRowHead,
  StatRowHead,
  StatTable,
  type StatSort,
} from '@myrddraall/heroes-replay-stats-replays/ui';
import { AGGREGATES, GROUP_BYS, type Aggregate, type GroupBy } from '../../model';
import {
  AGGREGATE_LABELS,
  GROUP_BY_LABELS,
  type PlayerBreakdownModel,
} from './player-breakdown.presenter';

/**
 * One section of a player's stats (presentational): a match's stat table with a row for each hero,
 * role, map or mode the player's matches split into, and the choices of what splits them and how
 * each group's matches become one figure.
 */
@Component({
  selector: 'hrs-player-breakdown',
  imports: [MatButtonToggleModule, ScoreRowHead, StatRowHead, StatTable, StyledText],
  templateUrl: './player-breakdown.html',
  styleUrl: './player-breakdown.scss',
})
export class PlayerBreakdown {
  readonly title = input.required<string>();
  readonly breakdown = input.required<PlayerBreakdownModel>();
  /** What the matches are split by. */
  readonly groupBy = model<GroupBy>('hero');
  /** How a group's matches become one figure. */
  readonly aggregate = model<Aggregate>('average');
  /** The table's order; none keeps the groups' own (most matches first). */
  readonly sort = model<StatSort | null>(null);

  protected readonly groupBys = GROUP_BYS.map((value) => ({ value, label: GROUP_BY_LABELS[value] }));
  protected readonly aggregates = AGGREGATES.map((value) => ({
    value,
    label: AGGREGATE_LABELS[value],
  }));
  protected readonly groupByLabels = GROUP_BY_LABELS;
}
