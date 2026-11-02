import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { StatColumn } from '../stat-column';
import type { StatTableRow } from '../stat-cells';
import type { StatRowHead } from '../stat-row-head';
import { statRanks } from '../stat-sort';

/**
 * The score table as a ranking, for narrow screens (presentational): a chip per stat to rank by,
 * then a card per row in rank order with its place (ties share one), its row head, the ranking
 * stat large and every other stat small, each column's best marked as in the table.
 */
@Component({
  selector: 'ui-score-cards',
  imports: [MatIcon, MatTooltip, NgTemplateOutlet],
  templateUrl: './score-cards.html',
  styleUrl: './score-cards.scss',
})
export class ScoreCards<T> {
  readonly columns = input.required<readonly StatColumn[]>();
  /** The rows already in rank order, as `statTableRows` gives them. */
  readonly table = input.required<readonly StatTableRow<T>[]>();
  /** The column the rows are ranked by. */
  readonly rankBy = input.required<string>();
  /** What each card shows of who the row is. */
  readonly rowHead = input<StatRowHead<T>>();
  /** A chip was pressed: rank by this column. */
  readonly rankRequested = output<string>();

  protected readonly cards = computed(() => {
    const rankBy = this.rankBy();
    const columns = new Map(this.columns().map((c) => [c.id, c]));
    const table = this.table();
    const ranks = statRanks(
      table.map((line) => line.row),
      rankBy,
    );
    return table.map((line, i) => {
      const stats = line.cells.map((cell) => ({ cell, column: columns.get(cell.column) }));
      return {
        line,
        rank: ranks[i],
        main: stats.find((s) => s.cell.column === rankBy),
        others: stats.filter((s) => s.cell.column !== rankBy),
      };
    });
  });
}
