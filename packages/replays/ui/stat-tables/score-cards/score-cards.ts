import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { NumberCell } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { ScoreRowBar } from '../score-row/score-row-bar';
import { StatIcon } from '../stat-icon/stat-icon';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import type { StatColumn } from '../../../model';
import type { StatTableRow } from '../stat-cells';
import type { StatRowHead } from '../stat-row-head';

/**
 * The score table as a ranking, for narrow screens (presentational): a chip per stat to rank by,
 * (pressed again, worst first; a third time, unranked: the rows' own order), then a card per row
 * in that order, each a row of the table (its texture, bar and row head,
 * _score-row.scss) with the ranking stat at its end, every other stat under it; figures in the
 * table's type, each column's best marked as there.
 */
@Component({
  selector: 'ui-score-cards',
  imports: [MatTooltip, NgTemplateOutlet, NumberCell, ScoreRowBar, Sprite, StatIcon],
  templateUrl: './score-cards.html',
  styleUrl: './score-cards.scss',
})
export class ScoreCards<T> {
  readonly columns = input.required<readonly StatColumn[]>();
  /** The rows already in rank order, as `statTableRows` gives them. */
  readonly table = input.required<readonly StatTableRow<T>[]>();
  /** The column the rows are ranked by; null when they are in their own order. */
  readonly rankBy = input.required<string | null>();
  /** Whether the ranking is best or worst first. */
  readonly rankOrder = input<'best-first' | 'worst-first' | null>(null);
  /** What each card shows of who the row is. */
  readonly rowHead = input<StatRowHead<T>>();
  /** A chip was pressed: rank by this column (or, pressed again, the other way, then not at all). */
  readonly rankRequested = output<string>();

  protected readonly cards = computed(() => {
    // the stat at a card's end: the ranked one, or the first while unsorted
    const rankBy = this.rankBy() ?? this.columns()[0]?.id;
    const columns = new Map(this.columns().map((c) => [c.id, c]));
    return this.table().map((line) => {
      const stats = line.cells.map((cell) => ({ cell, column: columns.get(cell.column) }));
      return {
        line,
        main: stats.find((s) => s.cell.column === rankBy),
        others: stats.filter((s) => s.cell.column !== rankBy),
      };
    });
  });
}
